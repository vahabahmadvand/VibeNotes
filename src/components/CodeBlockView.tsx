import React, { useState } from 'react';
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import { Check, Copy, Code2, ChevronDown, ChevronRight } from 'lucide-react';

const LANGUAGES = [
  { value: 'plaintext', label: 'Plain Text' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'rust', label: 'Rust' },
  { value: 'cpp', label: 'C++' },
  { value: 'csharp', label: 'C#' },
  { value: 'json', label: 'JSON' },
  { value: 'sql', label: 'SQL' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'bash', label: 'Bash / Shell' },
  { value: 'markdown', label: 'Markdown' },
];

export const CodeBlockView: React.FC<any> = ({ node, updateAttributes }) => {
  const [copied, setCopied] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const currentLang = node.attrs.language || 'plaintext';

  const textContent = node.textContent || '';
  const linesCount = textContent.split('\n').length;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(textContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleCollapse = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsCollapsed(!isCollapsed);
  };

  return (
    <NodeViewWrapper className="code-block-wrapper relative my-3 rounded-lg overflow-hidden border border-zinc-700/80 bg-[#1e1e1e] text-[#f8fafc] shadow-md text-xs font-mono select-none">
      {/* Code Header Bar */}
      <div className="flex items-center justify-between px-2.5 py-1.5 bg-[#252526] border-b border-zinc-700/60 select-none text-zinc-300">
        <div className="flex items-center gap-1.5">
          {/* Collapse/Expand Chevron */}
          <button
            contentEditable={false}
            onClick={toggleCollapse}
            className="w-5 h-5 flex items-center justify-center rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700/60 transition-colors cursor-pointer"
            title={isCollapsed ? 'Expand code block' : 'Collapse code block'}
          >
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </button>

          <Code2 size={13} className="text-zinc-400" />

          {/* Language Selector */}
          <select
            contentEditable={false}
            value={currentLang}
            onChange={(e) => updateAttributes({ language: e.target.value })}
            className="bg-transparent text-xs text-[#9cdcfe] hover:text-[#4ec9b0] font-medium outline-none cursor-pointer pr-1"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.value} value={lang.value} className="bg-[#252526] text-zinc-200">
                {lang.label}
              </option>
            ))}
          </select>

          {/* Line Count Badge */}
          {linesCount > 1 && (
            <span
              onClick={toggleCollapse}
              className="text-[10px] text-zinc-400 hover:text-zinc-200 bg-zinc-800/80 px-1.5 py-0.5 rounded cursor-pointer transition-colors"
              title="Toggle collapse"
            >
              {linesCount} lines
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Collapse / Expand Text Button */}
          {linesCount > 4 && (
            <button
              contentEditable={false}
              onClick={toggleCollapse}
              className="px-2 py-0.5 rounded text-[11px] text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              {isCollapsed ? 'Expand' : 'Collapse'}
            </button>
          )}

          {/* Copy Button */}
          <button
            contentEditable={false}
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors border border-zinc-700 cursor-pointer"
            title="Copy code"
          >
            {copied ? (
              <>
                <Check size={12} className="text-emerald-400" />
                <span className="text-emerald-400 font-medium">Copied</span>
              </>
            ) : (
              <>
                <Copy size={12} />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Code content container */}
      {isCollapsed ? (
        <div
          onClick={() => setIsCollapsed(false)}
          className="px-3 py-2 text-[12px] text-zinc-400 hover:text-zinc-300 italic cursor-pointer bg-[#18181b] flex items-center justify-between border-t border-zinc-800"
        >
          <span>// Collapsed ({linesCount} lines) — click to expand</span>
          <span className="text-[10px] text-zinc-400 underline">Show</span>
        </div>
      ) : (
        <pre className="p-3 overflow-x-auto text-[13px] leading-relaxed font-mono select-text bg-[#1e1e1e] text-[#f8fafc] max-h-[380px] overflow-y-auto">
          <NodeViewContent as="div" className={`language-${currentLang}`} />
        </pre>
      )}
    </NodeViewWrapper>
  );
};
