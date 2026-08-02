/**
 * useProjects — IndexedDB ChatGPT-style project folders (name, color, instructions)
 */

import { useState, useEffect, useCallback } from "react";
import type { Project } from "~/lib/types";
import {
    getAllProjects,
    saveProject,
    deleteProjectFromDB,
} from "~/lib/db";

export function useProjects() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);

    const refreshProjects = useCallback(async () => {
        const list = await getAllProjects();
        setProjects(list);
        setLoading(false);
        return list;
    }, []);

    useEffect(() => {
        let cancelled = false;
        void (async () => {
            const list = await refreshProjects();
            if (cancelled) return;
            setProjects(list);
        })();
        return () => {
            cancelled = true;
        };
    }, [refreshProjects]);

    const createProject = useCallback(
        async (name: string, color: string, instructions = "") => {
            const project: Project = {
                id: `project_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                name: name.trim() || "New Project",
                color,
                instructions: instructions.trim() || undefined,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            };
            await saveProject(project);
            await refreshProjects();
            return project;
        },
        [refreshProjects],
    );

    const updateProject = useCallback(
        async (id: string, patch: Partial<Project>) => {
            const list = await getAllProjects();
            const existing = list.find((p) => p.id === id);
            if (!existing) return;
            const next: Project = { ...existing, ...patch, updatedAt: Date.now() };
            await saveProject(next);
            setProjects((prev) =>
                prev.map((p) => (p.id === id ? next : p)),
            );
        },
        [],
    );

    const deleteProject = useCallback(
        async (id: string) => {
            await deleteProjectFromDB(id);
            setProjects((prev) => prev.filter((p) => p.id !== id));
        },
        [],
    );

    return {
        projects,
        loading,
        refreshProjects,
        createProject,
        updateProject,
        deleteProject,
    };
}
