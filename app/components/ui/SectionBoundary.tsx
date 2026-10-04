import { Component, type ReactNode } from "react";

interface Props {
    label: string;
    resetKey?: unknown;
    fallback?: ReactNode;
    children: ReactNode;
}
interface State {
    error: Error | null;
    copyStatus: string;
}

export class SectionBoundary extends Component<Props, State> {
    state: State = { error: null, copyStatus: "Copy error" };

    static getDerivedStateFromError(error: Error): State {
        return { error, copyStatus: "Copy error" };
    }

    componentDidUpdate(previous: Props) {
        if (this.state.error && previous.resetKey !== this.props.resetKey) {
            this.setState({ error: null, copyStatus: "Copy error" });
        }
    }

    copyError = async () => {
        const name = this.state.error?.name;
        const kind = name && /^[A-Za-z]*Error$/.test(name) ? name : "Error";
        const diagnostic = `ai.diy / ${this.props.label}\n${kind}\nBuild: ${typeof __BUILD_ID__ === "string" ? __BUILD_ID__ : "test"}\nError contents omitted to protect keys and conversation data.`;
        try {
            await navigator.clipboard.writeText(diagnostic);
            this.setState({ copyStatus: "Copied" });
        } catch {
            this.setState({ copyStatus: "Clipboard unavailable" });
        }
    };

    render() {
        if (!this.state.error) return this.props.children;
        return (
            <>
                <div
                    role="alert"
                    className="m-3 flex flex-col gap-3 rounded-md border border-border bg-muted/40 p-4 text-sm"
                >
                    <p className="font-medium">{this.props.label} couldn’t be displayed.</p>
                    <p className="text-muted-foreground">
                        The rest of your workspace is still available. Retry this section without
                        resetting your data.
                    </p>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            className="min-h-11 rounded-md border border-border px-3 hover:bg-accent focus-visible:outline-2"
                            onClick={() => this.setState({ error: null, copyStatus: "Copy error" })}
                        >
                            Retry {this.props.label}
                        </button>
                        <button
                            type="button"
                            className="min-h-11 rounded-md border border-border px-3 hover:bg-accent focus-visible:outline-2"
                            onClick={this.copyError}
                        >
                            {this.state.copyStatus}
                        </button>
                    </div>
                </div>
                {this.props.fallback}
            </>
        );
    }
}
