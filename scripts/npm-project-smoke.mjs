import {
  planNpmProject,
  normalizeNpmProjectName,
  normalizeProjectFilePath,
  validatePackageSpec,
} from "../app/lib/npm-project.ts";
import { detectNpmProjectIntent } from "../app/lib/skill-command.ts";

let failures = 0;

function check(name, condition, detail = "") {
  if (condition) {
    console.log(`ok - ${name}`);
  } else {
    failures += 1;
    console.error(`FAIL - ${name}${detail ? `: ${detail}` : ""}`);
  }
}

check("normalizes project names", normalizeNpmProjectName("My Demo App") === "my-demo-app");
check("rejects traversal project name", (() => {
  try {
    normalizeNpmProjectName("..");
    return false;
  } catch {
    return true;
  }
})());
check("normalizes relative file paths", normalizeProjectFilePath("src\\App.jsx") === "src/App.jsx");
check("rejects relative traversal", (() => {
  try {
    normalizeProjectFilePath("src/../secret.txt");
    return false;
  } catch {
    return true;
  }
})());
check("accepts registry package", validatePackageSpec("react@19.1.0") === "react@19.1.0");
check("accepts scoped registry package", validatePackageSpec("@types/node@22.0.0") === "@types/node@22.0.0");
check("rejects git package", (() => {
  try {
    validatePackageSpec("git+https://example.com/pkg.git");
    return false;
  } catch {
    return true;
  }
})());
check("rejects shell package", (() => {
  try {
    validatePackageSpec("react;rm -rf /");
    return false;
  } catch {
    return true;
  }
})());
check("detects npm build intent", detectNpmProjectIntent("Build a React app with npm packages"));
check("does not force npm for a definition", !detectNpmProjectIntent("What is npm?"));

const init = planNpmProject({ action: "init", project: "demo" });
check("init starts from an existing VM directory", init.kind === "command" && init.cwd === "/home/user");
check("init is idempotent", init.kind === "command" && init.command.includes("[ ! -f '/home/user/projects/demo/package.json' ]"));
check("init installs the stable project helper", init.kind === "command" && init.command.includes("npm-project-helper.py"));

const write = planNpmProject({
  action: "write",
  project: "demo",
  files: { "src/index.js": "console.log('ok')" },
});
check("write uses the stable VM decoder", write.kind === "command" && write.command.includes("python3 -c"));

const install = planNpmProject({
  action: "install",
  project: "demo",
  packages: ["react@19.1.0", "@types/node@22.0.0"],
});
check("install disables lifecycle scripts", install.kind === "command" && install.command.includes("--ignore-scripts"));
check("install uses exact saves", install.kind === "command" && install.command.includes("--save-exact"));
check("install allows only registry specs", install.kind === "command" && !install.command.includes("git+"));

const exported = planNpmProject({ action: "export", project: "demo" });
check("export uses the stable project helper", exported.kind === "export" && exported.command.includes("npm-project-helper.py"));
check("export stays in temporary VM storage", exported.kind === "export" && exported.archivePath.startsWith("/tmp/aidiy-demo"));
const preview = planNpmProject({ action: "preview", project: "demo" });
check("preview defaults to dev", preview.kind === "command" && preview.command.includes("npm run 'dev'"));
check("preview rejects arbitrary scripts", (() => {
  try {
    planNpmProject({ action: "preview", project: "demo", script: "build" });
    return false;
  } catch {
    return true;
  }
})());
check("run rejects arbitrary scripts", (() => {
  try {
    planNpmProject({ action: "run", project: "demo", script: "publish" });
    return false;
  } catch {
    return true;
  }
})());

if (failures > 0) process.exit(1);
console.log("All npm project checks passed.");
