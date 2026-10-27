'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  FolderKey,
  Plus,
  Terminal,
  ChevronRight,
  ShieldCheck,
  Loader2,
  Copy,
  Check,
  AlertCircle,
} from 'lucide-react';

interface ProjectEnvironment {
  id: string;
  name: string;
  slug: string;
  secretCount: number;
}

interface Project {
  id: string;
  name: string;
  slug: string;
  description?: string;
  createdAt: string;
  environments: ProjectEnvironment[];
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create Project Modal state
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [copiedCli, setCopiedCli] = useState(false);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/projects');
      if (!res.ok) throw new Error('Failed to load projects');
      const data = await res.json();
      setProjects(data.projects || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setCreating(true);
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create project');
      }
      setName('');
      setDescription('');
      setShowModal(false);
      await fetchProjects();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCreating(false);
    }
  };

  const copyCliCommand = () => {
    navigator.clipboard.writeText('keyzen run -- npm start');
    setCopiedCli(true);
    setTimeout(() => setCopiedCli(false), 2000);
  };

  return (
    <div className="space-y-8">
      {/* Top Banner / Hero */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#222222]">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Projects
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Manage your encrypted environments and runtime zero-disk secrets.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500 hover:bg-green-400 text-black font-semibold text-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Project</span>
          </button>
        </div>
      </div>

      {/* Quick Start Terminal Box */}
      <div className="bg-[#0f0f0f] border border-[#222222] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3">
          <div className="p-2 rounded-lg bg-black border border-[#222222] text-green-400">
            <Terminal className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-mono text-gray-400">Inject secrets with zero disk footprint:</div>
            <code className="text-sm font-mono text-green-400 font-semibold">keyzen run -- npm start</code>
          </div>
        </div>

        <button
          onClick={copyCliCommand}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#1a1a1a] hover:bg-[#252525] border border-[#2b2b2b] text-xs text-gray-300 font-mono transition-colors self-start sm:self-auto"
        >
          {copiedCli ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copiedCli ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>

      {/* Loading & Error States */}
      {loading && (
        <div className="py-20 flex flex-col items-center justify-center gap-3 text-gray-500">
          <Loader2 className="w-6 h-6 animate-spin text-green-400" />
          <p className="text-sm font-mono">Loading projects...</p>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-lg bg-red-950/40 border border-red-800 text-red-300 flex items-center gap-2 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Projects Grid */}
      {!loading && !error && projects.length === 0 && (
        <div className="text-center py-16 border border-dashed border-[#222222] rounded-xl">
          <FolderKey className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-gray-300">No projects found</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1 mb-4">
            Create your first project to start storing and injecting encrypted secrets.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 rounded-lg bg-green-500 hover:bg-green-400 text-black font-semibold text-xs transition-colors"
          >
            Create Project
          </button>
        </div>
      )}

      {!loading && !error && projects.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/dashboard/${project.id}`}
              className="group block p-5 rounded-xl bg-[#0c0c0c] border border-[#222222] hover:border-green-500/40 transition-all hover:bg-[#121212]"
            >
              <div className="flex items-start justify-between">
                <div className="w-9 h-9 rounded-lg bg-[#161616] border border-[#282828] flex items-center justify-center text-green-400 group-hover:border-green-500/30 transition-colors">
                  <FolderKey className="w-4 h-4" />
                </div>
                <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-green-400 transition-colors" />
              </div>

              <h2 className="text-base font-semibold text-white mt-4 group-hover:text-green-400 transition-colors">
                {project.name}
              </h2>
              <p className="text-xs text-gray-400 mt-1 line-clamp-2 min-h-[32px]">
                {project.description || 'No description provided'}
              </p>

              {/* Environments badges */}
              <div className="mt-4 pt-3 border-t border-[#1a1a1a] flex flex-wrap gap-2">
                {project.environments.map((env) => (
                  <span
                    key={env.id}
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono bg-[#161616] border border-[#282828] text-gray-300"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                    <span>{env.slug}</span>
                    <span className="text-gray-500">({env.secretCount})</span>
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Create Project Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111111] border border-[#262626] rounded-xl max-w-md w-full p-6 space-y-4">
            <h2 className="text-lg font-bold text-white">Create New Project</h2>
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-gray-400 mb-1">Project Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. backend-api"
                  className="w-full bg-[#181818] border border-[#2b2b2b] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500 font-sans"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-gray-400 mb-1">Description (Optional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What is this project for?"
                  rows={2}
                  className="w-full bg-[#181818] border border-[#2b2b2b] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500 font-sans"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg bg-[#222222] hover:bg-[#2c2c2c] text-sm text-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 rounded-lg bg-green-500 hover:bg-green-400 text-black font-semibold text-sm transition-colors flex items-center gap-2"
                >
                  {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{creating ? 'Creating...' : 'Create'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
