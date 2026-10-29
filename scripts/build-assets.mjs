#!/usr/bin/env node
// Renders the SVG assets used by the profile README.
//
//   node scripts/build-assets.mjs static            -> assets/ (header, committed)
//   node scripts/build-assets.mjs stats --out dist  -> dist/   (stats, project cards with live star counts and
//                                                               the rotating Zot card, published to the `output` branch)
//
// `stats` reads GitHub data with GITHUB_TOKEN, or from a saved GraphQL response via `--data <file>`.
// `--slot <n>` pins the Zot card rotation, which otherwise advances every 6 hours.
// `--readme <file>` rewrites the project grid in that README, most-starred project first.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const USER = "Yide-Milo-Li";

// Glue languages that say little about what a repo is written in.
const HIDDEN_LANGUAGES = new Set(["Makefile", "PowerShell", "Batchfile", "Shell", "HTML", "CSS"]);

const THEMES = {
  dark: {
    bg: "#0d1117",
    panel: "#161b22",
    border: "#30363d",
    grid: "#21262d",
    text: "#e6edf3",
    muted: "#8b949e",
    accent: "#ffd200",
    accent2: "#4aa3df",
    chipBg: "#1f2a37",
    chipText: "#c9d1d9",
    difficulty: { Easy: "#00b8a3", Medium: "#ffb800", Hard: "#ff375f" },
  },
  light: {
    bg: "#ffffff",
    panel: "#f6f8fa",
    border: "#d0d7de",
    grid: "#eaeef2",
    text: "#1f2328",
    muted: "#59636e",
    accent: "#c99700",
    accent2: "#0064a4",
    chipBg: "#eaf2f8",
    chipText: "#0b3d63",
    difficulty: { Easy: "#00897b", Medium: "#b97a00", Hard: "#d6224a" },
  },
};

const PROJECTS = [
  {
    slug: "leetcode-tracker",
    alt: "LeetCode-Tracker: a local-first desktop workbench for algorithm practice. TypeScript, React, Tauri, Rust, SQLite.",
    name: "LeetCode-Tracker",
    blurb:
      "A local-first desktop workbench for algorithm practice: bring your own JSONL catalog, plan a weekly routine, and keep Markdown notes beside each problem.",
    meta: "Windows x64 · macOS ARM64 · works offline",
    stack: ["TypeScript", "React", "Tauri", "Rust", "SQLite"],
  },
  {
    slug: "anteaterchess-reborn",
    alt: "AnteaterChess-Reborn: an 8 by 10 chess variant with Ants and chain-capturing Anteaters. C++20, Qt 6, QML.",
    name: "AnteaterChess-Reborn",
    blurb:
      "Chess on an 8 × 10 board with Ants and chain-capturing Anteaters. Play a friend, take on the AI, or let two engines fight it out.",
    meta: "Windows · Ubuntu · Qt-independent core",
    stack: ["C++20", "Qt 6", "QML", "CMake"],
  },
  {
    slug: "anteaterpoker",
    alt: "AnteaterPoker: online Texas Hold'em in C with a socket server, GTK clients and bot players.",
    name: "AnteaterPoker",
    blurb:
      "Online Texas Hold'em with Anteater house rules, written in C by a team of six: a socket server, GTK clients, and bot players.",
    meta: "Team project · UCI EECS 22L",
    stack: ["C", "Sockets", "GTK", "Make"],
  },
  {
    slug: "agentrelay",
    alt: "AgentRelay, coming soon: a self-hosted prompt relay that hands tasks between devices and coding agents over MCP.",
    name: "AgentRelay",
    comingSoon: true,
    blurb:
      "A self-hosted prompt relay for coding agents. Hand a task from one device to the next over MCP, with full context, claim tracking and receipts.",
    meta: "Work in progress · private for now",
    stack: ["TypeScript", "Next.js", "MCP", "Cloudflare D1"],
  },
];

// The "Zot zot" card shows one problem and one fact, rotating every time the workflow runs.
const PICKS = [
  { id: 1, title: "Two Sum", difficulty: "Easy", tags: ["Array", "Hash Table"] },
  { id: 3, title: "Longest Substring Without Repeating Characters", difficulty: "Medium", tags: ["Sliding Window", "Hash Table"] },
  { id: 11, title: "Container With Most Water", difficulty: "Medium", tags: ["Two Pointers", "Greedy"] },
  { id: 15, title: "3Sum", difficulty: "Medium", tags: ["Two Pointers", "Sorting"] },
  { id: 20, title: "Valid Parentheses", difficulty: "Easy", tags: ["Stack", "String"] },
  { id: 33, title: "Search in Rotated Sorted Array", difficulty: "Medium", tags: ["Binary Search"] },
  { id: 42, title: "Trapping Rain Water", difficulty: "Hard", tags: ["Two Pointers", "Monotonic Stack"] },
  { id: 49, title: "Group Anagrams", difficulty: "Medium", tags: ["Hash Table", "Sorting"] },
  { id: 53, title: "Maximum Subarray", difficulty: "Medium", tags: ["Dynamic Programming"] },
  { id: 56, title: "Merge Intervals", difficulty: "Medium", tags: ["Sorting", "Intervals"] },
  { id: 70, title: "Climbing Stairs", difficulty: "Easy", tags: ["Dynamic Programming"] },
  { id: 76, title: "Minimum Window Substring", difficulty: "Hard", tags: ["Sliding Window", "Hash Table"] },
  { id: 79, title: "Word Search", difficulty: "Medium", tags: ["Backtracking", "Matrix"] },
  { id: 84, title: "Largest Rectangle in Histogram", difficulty: "Hard", tags: ["Monotonic Stack"] },
  { id: 98, title: "Validate Binary Search Tree", difficulty: "Medium", tags: ["Tree", "DFS"] },
  { id: 121, title: "Best Time to Buy and Sell Stock", difficulty: "Easy", tags: ["Array", "Dynamic Programming"] },
  { id: 124, title: "Binary Tree Maximum Path Sum", difficulty: "Hard", tags: ["Tree", "DFS"] },
  { id: 127, title: "Word Ladder", difficulty: "Hard", tags: ["BFS", "Hash Table"] },
  { id: 141, title: "Linked List Cycle", difficulty: "Easy", tags: ["Linked List", "Two Pointers"] },
  { id: 146, title: "LRU Cache", difficulty: "Medium", tags: ["Design", "Hash Table", "Linked List"] },
  { id: 200, title: "Number of Islands", difficulty: "Medium", tags: ["BFS", "Union Find"] },
  { id: 206, title: "Reverse Linked List", difficulty: "Easy", tags: ["Linked List"] },
  { id: 207, title: "Course Schedule", difficulty: "Medium", tags: ["Graph", "Topological Sort"] },
  { id: 208, title: "Implement Trie (Prefix Tree)", difficulty: "Medium", tags: ["Trie", "Design"] },
  { id: 215, title: "Kth Largest Element in an Array", difficulty: "Medium", tags: ["Heap", "Quickselect"] },
  { id: 238, title: "Product of Array Except Self", difficulty: "Medium", tags: ["Array", "Prefix Sum"] },
  { id: 239, title: "Sliding Window Maximum", difficulty: "Hard", tags: ["Monotonic Queue"] },
  { id: 295, title: "Find Median from Data Stream", difficulty: "Hard", tags: ["Heap", "Design"] },
  { id: 300, title: "Longest Increasing Subsequence", difficulty: "Medium", tags: ["Dynamic Programming", "Binary Search"] },
  { id: 322, title: "Coin Change", difficulty: "Medium", tags: ["Dynamic Programming"] },
  { id: 435, title: "Non-overlapping Intervals", difficulty: "Medium", tags: ["Greedy", "Intervals"] },
  { id: 743, title: "Network Delay Time", difficulty: "Medium", tags: ["Graph", "Dijkstra"] },
];

const FACTS = [
  "UCI students picked the anteater as mascot in 1965, borrowing \"Zot!\" from the comic strip B.C.",
  "Giant anteaters have no teeth. Their tongue can reach about 60 cm and flick up to 150 times a minute.",
  "A giant anteater can eat around 30,000 ants and termites in a single day.",
  "Giant anteaters run at roughly 33 °C, one of the lowest body temperatures of any land mammal.",
  "In AnteaterChess, an Anteater only eats Ants, chaining up to ten captures in one move.",
  "In 1947, Grace Hopper's team taped a moth from the Harvard Mark II into their log: the first actual bug.",
  "Dijkstra worked out his shortest-path algorithm in about twenty minutes at an Amsterdam café, without pen or paper.",
  "Tony Hoare came up with Quicksort in 1959 while working on machine translation in Moscow.",
  "Binary search was first published in 1946; per Knuth, a version correct for every n did not appear until 1962.",
  "Java's Arrays.binarySearch shipped with an overflow bug in (low + high) / 2 that went unnoticed for about nine years.",
  "SQLite is likely the most widely deployed database engine, with billions of copies running worldwide.",
  "Rust's borrow checker turns many memory and data-race bugs into compile errors.",
];

const SANS ="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace";

const escapeXml = (value) =>
  String(value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);

// SVG has no text wrapping, so break on word boundaries using an average glyph width.
function wrapText(text, maxWidth, fontSize) {
  const maxChars = Math.floor(maxWidth / (fontSize * 0.53));
  const lines = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

const chipWidth = (label) => Math.round(label.length * 7.4 + 22);

function chips(labels, x, y, t) {
  let cursor = x;
  return labels
    .map((label) => {
      const w = chipWidth(label);
      const out = `<g transform="translate(${cursor} ${y})"><rect width="${w}" height="24" rx="12" fill="${t.chipBg}"/><text x="${w / 2}" y="16.5" text-anchor="middle" font-family="${MONO}" font-size="12" fill="${t.chipText}">${escapeXml(label)}</text></g>`;
      cursor += w + 8;
      return out;
    })
    .join("");
}

const reducedMotion = `@media (prefers-reduced-motion: reduce) { * { animation: none !important; } }`;

function renderHeader(t) {
  const W = 1200;
  const H = 300;

  // Right side: an 8 x 10 board (the AnteaterChess layout), fading out toward the text.
  const cell = 30;
  const cols = 10;
  const rows = 8;
  const bx = W - 60 - cols * cell;
  const by = (H - rows * cell) / 2;
  const squares = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if ((r + c) % 2 === 0) squares.push(`<rect x="${bx + c * cell}" y="${by + r * cell}" width="${cell}" height="${cell}"/>`);
    }
  }

  // An Anteater's capture chain: one diagonal step, then orthogonal hops.
  const route = [
    [2, 6],
    [3, 5],
    [4, 5],
    [4, 4],
    [5, 4],
    [5, 3],
    [6, 3],
    [6, 2],
  ];
  const center = ([c, r]) => [bx + c * cell + cell / 2, by + r * cell + cell / 2];
  const points = route.map(center);
  const d = points.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ");
  const pathLength = points.slice(1).reduce((sum, [x, y], i) => sum + Math.hypot(x - points[i][0], y - points[i][1]), 0);
  const ants = points
    .slice(1)
    .map(([x, y], i) => `<circle class="ant" style="animation-delay:${(0.9 + i * 0.32).toFixed(2)}s" cx="${x}" cy="${y}" r="4.5" fill="${t.muted}"/>`)
    .join("");
  const [sx, sy] = points[0];

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="title">
<title id="title">Yide (Milo) Li. Computer Science at UC Irvine.</title>
<defs>
  <linearGradient id="fade" x1="0" x2="1" y1="0" y2="0">
    <stop offset="0" stop-color="#fff" stop-opacity="0"/>
    <stop offset="0.45" stop-color="#fff" stop-opacity="0.9"/>
    <stop offset="1" stop-color="#fff" stop-opacity="1"/>
  </linearGradient>
  <mask id="boardMask"><rect x="${bx - 40}" y="0" width="${cols * cell + 80}" height="${H}" fill="url(#fade)"/></mask>
</defs>
<style>
  .route { stroke-dasharray: ${pathLength.toFixed(1)}; stroke-dashoffset: ${pathLength.toFixed(1)}; animation: draw 6s ease-in-out infinite; }
  .ant { animation: eat 6s ease-in-out infinite; }
  .caret { animation: blink 1.1s steps(1) infinite; }
  @keyframes draw { 0% { stroke-dashoffset: ${pathLength.toFixed(1)}; } 45%, 80% { stroke-dashoffset: 0; } 100% { stroke-dashoffset: 0; opacity: 0; } }
  @keyframes eat { 0%, 15% { opacity: 1; } 30%, 85% { opacity: 0.15; } 100% { opacity: 1; } }
  @keyframes blink { 50% { opacity: 0; } }
  ${reducedMotion}
</style>
<rect width="${W}" height="${H}" rx="16" fill="${t.bg}"/>
<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="16" fill="none" stroke="${t.border}"/>
<g mask="url(#boardMask)">
  <g fill="${t.grid}">${squares.join("")}</g>
  <rect x="${bx}" y="${by}" width="${cols * cell}" height="${rows * cell}" fill="none" stroke="${t.border}"/>
  ${ants}
  <path class="route" d="${d}" fill="none" stroke="${t.accent}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="${sx}" cy="${sy}" r="7" fill="${t.accent}"/>
</g>
<text x="64" y="92" font-family="${MONO}" font-size="16" fill="${t.accent2}">~/yide-milo-li<tspan fill="${t.muted}"> $ whoami</tspan><tspan class="caret" fill="${t.accent}"> ▍</tspan></text>
<text x="62" y="160" font-family="${SANS}" font-size="56" font-weight="700" fill="${t.text}" letter-spacing="-1">Yide (Milo) Li</text>
<text x="64" y="202" font-family="${SANS}" font-size="20" fill="${t.muted}">Computer Science at UC Irvine. I build desktop software</text>
<text x="64" y="230" font-family="${SANS}" font-size="20" fill="${t.muted}">that runs on your own machine.</text>
<rect x="64" y="252" width="44" height="4" rx="2" fill="${t.accent}"/>
</svg>
`;
}

function starPill(stars, right, y, t) {
  const label = `★ ${stars.toLocaleString("en-US")}`;
  const w = Math.round(label.length * 8.6 + 24);
  return `<g transform="translate(${right - w} ${y})"><title>${stars} stars</title><rect x="0.5" y="0.5" width="${w - 1}" height="27" rx="13.5" fill="none" stroke="${t.accent}"/><text x="${w / 2}" y="19" text-anchor="middle" font-family="${SANS}" font-size="14" font-weight="600" fill="${t.accent}">${escapeXml(label)}</text></g>`;
}

// Placeholder for a project that is not public yet: a pulsing dot instead of a star count.
function comingSoonPill(right, y, t) {
  const label = "Coming soon";
  const w = Math.round(label.length * 7.6 + 40);
  return `<g transform="translate(${right - w} ${y})"><rect x="0.5" y="0.5" width="${w - 1}" height="27" rx="13.5" fill="none" stroke="${t.accent2}"/><circle class="pulse" cx="16" cy="14" r="4" fill="${t.accent2}"/><text x="${(w + 18) / 2}" y="19" text-anchor="middle" font-family="${SANS}" font-size="13" font-weight="600" fill="${t.accent2}">${label}</text></g>`;
}

const cardWidth = (project) => (project.wide ? 1000 : 490);
const blurbLines = (project) => wrapText(project.blurb, cardWidth(project) - 56, 15);

// Half-width cards sit side by side, so they all pad their blurb to the tallest one.
const HALF_CARD_LINES = Math.max(...PROJECTS.filter((p) => !p.wide).map((p) => blurbLines(p).length));

function renderProjectCard(project, t, stars) {
  const W = cardWidth(project);
  const pad = 28;
  const blurbSize = 15;
  const lines = blurbLines(project);
  const blurbTop = 92;
  const lineHeight = 23;
  const rows = project.wide ? lines.length : HALF_CARD_LINES;
  const metaY = blurbTop + rows * lineHeight + 14;
  const chipsY = metaY + 18;
  const H = chipsY + 24 + pad;

  const blurb = lines
    .map((line, i) => `<text x="${pad}" y="${blurbTop + i * lineHeight}" font-family="${SANS}" font-size="${blurbSize}" fill="${t.text}">${escapeXml(line)}</text>`)
    .join("");

  const soon = Boolean(project.comingSoon);
  let badge;
  if (soon) badge = comingSoonPill(W - pad, pad + 14, t);
  else if (stars) badge = starPill(stars, W - pad, pad + 14, t);
  else badge = `<text x="${W - pad}" y="${pad + 38}" text-anchor="end" font-family="${SANS}" font-size="20" fill="${t.muted}">↗</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="title">
<title id="title">${escapeXml(project.name)}${soon ? " (coming soon)" : ""}</title>
${soon ? `<style>.pulse { animation: pulse 1.8s ease-in-out infinite; } @keyframes pulse { 50% { opacity: 0.25; } } ${reducedMotion}</style>` : ""}
<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="12" fill="${t.panel}" stroke="${soon ? t.accent2 : t.border}"${soon ? ` stroke-dasharray="6 5" stroke-opacity="0.6"` : ""}/>
<rect x="0" y="${pad}" width="4" height="34" rx="2" fill="${soon ? t.accent2 : t.accent}"/>
<text x="${pad}" y="${pad + 14}" font-family="${MONO}" font-size="12" fill="${t.accent2}" letter-spacing="0.5">${escapeXml(USER)} /</text>
<text x="${pad}" y="${pad + 38}" font-family="${SANS}" font-size="22" font-weight="700" fill="${t.text}">${escapeXml(project.name)}</text>
${badge}
${blurb}
<text x="${pad}" y="${metaY}" font-family="${MONO}" font-size="12" fill="${t.muted}">${escapeXml(project.meta)}</text>
${chips(project.stack, pad, chipsY, t)}
</svg>
`;
}

const PROFILE_QUERY = `query($login: String!) {
  user(login: $login) {
    followers { totalCount }
    contributionsCollection { contributionCalendar { totalContributions } }
    repositories(privacy: PUBLIC, ownerAffiliations: OWNER, isFork: false, first: 100) {
      totalCount
      nodes {
        name
        stargazerCount
        languages(first: 10, orderBy: { field: SIZE, direction: DESC }) { edges { size node { name color } } }
      }
    }
  }
}`;

async function fetchProfile() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN is not set (or pass --data <file>).");
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json", "User-Agent": `${USER}-profile` },
    body: JSON.stringify({ query: PROFILE_QUERY, variables: { login: USER } }),
  });
  const body = await res.json();
  if (!res.ok || body.errors) throw new Error(`GitHub GraphQL failed: ${JSON.stringify(body.errors ?? body)}`);
  return body;
}

function summarize({ data: { user } }) {
  const repos = user.repositories.nodes;
  const bytes = new Map();
  for (const repo of repos) {
    for (const { size, node } of repo.languages.edges) {
      if (HIDDEN_LANGUAGES.has(node.name)) continue;
      const prev = bytes.get(node.name) ?? { size: 0, color: node.color ?? "#8b949e" };
      bytes.set(node.name, { size: prev.size + size, color: prev.color });
    }
  }
  const total = [...bytes.values()].reduce((sum, l) => sum + l.size, 0) || 1;
  const languages = [...bytes.entries()]
    .map(([name, { size, color }]) => ({ name, color, share: size / total }))
    .sort((a, b) => b.share - a.share)
    .slice(0, 6);

  return {
    contributions: user.contributionsCollection.contributionCalendar.totalContributions,
    stars: repos.reduce((sum, r) => sum + r.stargazerCount, 0),
    starsByRepo: new Map(repos.map((r) => [r.name, r.stargazerCount])),
    publicRepos: user.repositories.totalCount,
    followers: user.followers.totalCount,
    languages,
  };
}

const CARD_W = 490;
const CARD_H = 200;

function cardFrame(title, body, t) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W}" height="${CARD_H}" viewBox="0 0 ${CARD_W} ${CARD_H}" role="img" aria-labelledby="title">
<title id="title">${escapeXml(title)}</title>
<style>
  .in { opacity: 0; animation: in 0.6s ease-out forwards; }
  @keyframes in { to { opacity: 1; } }
  ${reducedMotion}
</style>
<rect x="0.5" y="0.5" width="${CARD_W - 1}" height="${CARD_H - 1}" rx="12" fill="${t.panel}" stroke="${t.border}"/>
<text x="28" y="44" font-family="${SANS}" font-size="17" font-weight="700" fill="${t.text}">${escapeXml(title)}</text>
<rect x="28" y="56" width="28" height="3" rx="1.5" fill="${t.accent}"/>
${body}
</svg>
`;
}

function renderStats(stats, t) {
  const items = [
    ["Stars on public repos", stats.stars],
    ["Contributions, past year", stats.contributions],
    ["Public repositories", stats.publicRepos],
    ["Followers", stats.followers],
  ];
  const body = items
    .map(([label, value], i) => {
      const x = 28 + (i % 2) * 225;
      const y = 104 + Math.floor(i / 2) * 58;
      // Stars lead the card, so they get the accent star.
      const star = i === 0 ? `<tspan fill="${t.accent}">★ </tspan>` : "";
      return `<g class="in" style="animation-delay:${i * 0.12}s"><text x="${x}" y="${y}" font-family="${SANS}" font-size="28" font-weight="700" fill="${t.text}">${star}${value.toLocaleString("en-US")}</text><text x="${x}" y="${y + 20}" font-family="${SANS}" font-size="13" fill="${t.muted}">${escapeXml(label)}</text></g>`;
    })
    .join("");
  return cardFrame("GitHub at a glance", body, t);
}

function renderLanguages(stats, t) {
  const barX = 28;
  const barW = CARD_W - 56;
  let cursor = barX;
  const segments = stats.languages
    .map((lang, i) => {
      // The last segment absorbs rounding so the bar always ends flush.
      const w = i === stats.languages.length - 1 ? barX + barW - cursor : Math.max(2, Math.round(lang.share * barW));
      const out = `<rect x="${cursor}" y="80" width="${w}" height="10" fill="${lang.color}"/>`;
      cursor += w;
      return out;
    })
    .join("");
  const legend = stats.languages
    .map((lang, i) => {
      const x = 28 + (i % 2) * 225;
      const y = 124 + Math.floor(i / 2) * 26;
      return `<g class="in" style="animation-delay:${i * 0.08}s"><circle cx="${x + 5}" cy="${y - 4}" r="5" fill="${lang.color}"/><text x="${x + 18}" y="${y}" font-family="${SANS}" font-size="13.5" fill="${t.text}">${escapeXml(lang.name)}<tspan fill="${t.muted}" font-family="${MONO}" font-size="12">  ${(lang.share * 100).toFixed(1)}%</tspan></text></g>`;
    })
    .join("");
  const body = `<clipPath id="bar"><rect x="${barX}" y="80" width="${barW}" height="10" rx="5"/></clipPath><g clip-path="url(#bar)">${segments}</g>${legend}`;
  return cardFrame("Languages in public repos", body, t);
}

// One slot per 6-hour workflow run. Different strides keep the same problem and fact from always pairing up.
function zotPick(slot) {
  return { pick: PICKS[(slot * 7) % PICKS.length], fact: FACTS[(slot * 5) % FACTS.length] };
}

function renderZotCard({ pick, fact }, t) {
  const W = 1000;
  const pad = 28;
  const split = 470;
  const titleLines = wrapText(`#${pick.id}  ${pick.title}`, split - pad * 2, 18);
  const factLines = wrapText(fact, W - split - pad * 2, 15);
  const diffColor = t.difficulty[pick.difficulty];
  // Grow with whichever column wraps further so long titles never clip their tags.
  const H = Math.max(86 + titleLines.length * 24 + 28, 86 + factLines.length * 22) + pad;

  const title = titleLines
    .map((line, i) => `<text x="${pad}" y="${86 + i * 24}" font-family="${SANS}" font-size="18" font-weight="700" fill="${t.text}">${escapeXml(line)}</text>`)
    .join("");
  const factText = factLines
    .map((line, i) => `<text x="${split + pad}" y="${86 + i * 22}" font-family="${SANS}" font-size="15" fill="${t.text}">${escapeXml(line)}</text>`)
    .join("");
  const diffW = chipWidth(pick.difficulty);
  const tagsY = 86 + titleLines.length * 24 + 4;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="title">
<title id="title">Pick of the moment: LeetCode ${pick.id}, ${escapeXml(pick.title)}. Zot fact: ${escapeXml(fact)}</title>
<style>
  .in { opacity: 0; animation: in 0.6s ease-out forwards; }
  .wiggle { transform-origin: ${W - pad - 14}px 44px; animation: wiggle 3s ease-in-out infinite; }
  @keyframes in { to { opacity: 1; } }
  @keyframes wiggle { 0%, 80%, 100% { transform: rotate(0); } 85% { transform: rotate(-14deg); } 90% { transform: rotate(10deg); } 95% { transform: rotate(-6deg); } }
  ${reducedMotion}
</style>
<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="12" fill="${t.panel}" stroke="${t.border}"/>
<line x1="${split}" y1="${pad}" x2="${split}" y2="${H - pad}" stroke="${t.border}"/>
<g class="in">
  <text x="${pad}" y="48" font-family="${MONO}" font-size="12" fill="${t.accent2}" letter-spacing="1">PICK OF THE MOMENT</text>
  ${title}
  <g transform="translate(${pad} ${tagsY})"><rect width="${diffW}" height="24" rx="12" fill="none" stroke="${diffColor}"/><text x="${diffW / 2}" y="16.5" text-anchor="middle" font-family="${MONO}" font-size="12" fill="${diffColor}">${pick.difficulty}</text></g>
  ${chips(pick.tags, pad + diffW + 8, tagsY, t)}
</g>
<g class="in" style="animation-delay:0.2s">
  <text x="${split + pad}" y="48" font-family="${MONO}" font-size="12" fill="${t.accent}" letter-spacing="1">ZOT FACT</text>
  ${factText}
</g>
<text class="wiggle" x="${W - pad}" y="52" text-anchor="end" font-size="26">🐜</text>
</svg>
`;
}

// Most-starred first; the sort is stable, so config order breaks ties. Private repos count as 0 stars.
function orderProjects(starsByRepo) {
  const stars = (p) => starsByRepo.get(p.name) ?? 0;
  return [...PROJECTS].sort((a, b) => stars(b) - stars(a));
}

const OUTPUT_URL = `https://raw.githubusercontent.com/${USER}/${USER}/output`;
const PROJECTS_START = "<!-- projects:start -->";
const PROJECTS_END = "<!-- projects:end -->";

function projectGridMarkdown(ordered) {
  const card = (p) => {
    const picture = `<picture><source media="(prefers-color-scheme: dark)" srcset="${OUTPUT_URL}/${p.slug}-dark.svg" /><img src="${OUTPUT_URL}/${p.slug}-light.svg" alt="${escapeXml(p.alt)}" width="49%" /></picture>`;
    // Coming-soon repos are private, so a link would only lead visitors to a 404.
    return p.comingSoon ? picture : `<a href="https://github.com/${USER}/${p.name}">${picture}</a>`;
  };
  const rows = [];
  for (let i = 0; i < ordered.length; i += 2) rows.push(ordered.slice(i, i + 2).map(card).join("\n"));
  return rows.join("\n\n");
}

// Rewrites only the block between the project markers; returns whether the file changed.
async function updateReadmeProjects(file, ordered) {
  const readme = await readFile(file, "utf8");
  const start = readme.indexOf(PROJECTS_START);
  const end = readme.indexOf(PROJECTS_END);
  if (start === -1 || end < start) throw new Error(`${file} is missing the ${PROJECTS_START} / ${PROJECTS_END} markers.`);
  const next = `${readme.slice(0, start + PROJECTS_START.length)}\n${projectGridMarkdown(ordered)}\n${readme.slice(end)}`;
  if (next === readme) return false;
  await writeFile(file, next, "utf8");
  return true;
}

async function writeSvg(dir, name, svg) {
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), svg, "utf8");
  console.log(`wrote ${path.join(dir, name)}`);
}

function argValue(args, flag) {
  const i = args.indexOf(flag);
  return i === -1 ? undefined : args[i + 1];
}

async function main() {
  const [mode, ...args] = process.argv.slice(2);

  if (mode === "static") {
    const out = argValue(args, "--out") ?? "assets";
    for (const [name, t] of Object.entries(THEMES)) await writeSvg(out, `header-${name}.svg`, renderHeader(t));
    return;
  }

  if (mode === "stats") {
    const out = argValue(args, "--out") ?? "dist";
    const dataFile = argValue(args, "--data");
    const raw = dataFile ? JSON.parse(await readFile(dataFile, "utf8")) : await fetchProfile();
    const stats = summarize(raw);
    console.log(JSON.stringify({ ...stats, starsByRepo: Object.fromEntries(stats.starsByRepo) }));
    const slotArg = argValue(args, "--slot");
    const slot = slotArg === undefined ? Math.floor(Date.now() / (6 * 60 * 60 * 1000)) : Number(slotArg);
    const zot = zotPick(slot);
    for (const [name, t] of Object.entries(THEMES)) {
      await writeSvg(out, `zot-${name}.svg`, renderZotCard(zot, t));
      await writeSvg(out, `stats-${name}.svg`, renderStats(stats, t));
      await writeSvg(out, `languages-${name}.svg`, renderLanguages(stats, t));
      for (const project of PROJECTS) {
        await writeSvg(out, `${project.slug}-${name}.svg`, renderProjectCard(project, t, stats.starsByRepo.get(project.name)));
      }
    }
    const readme = argValue(args, "--readme");
    if (readme) {
      const ordered = orderProjects(stats.starsByRepo);
      const changed = await updateReadmeProjects(readme, ordered);
      console.log(`project order: ${ordered.map((p) => p.name).join(", ")} (${changed ? "README updated" : "unchanged"})`);
    }
    return;
  }

  console.error("usage: build-assets.mjs <static|stats> [--out dir] [--data file]");
  process.exit(2);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
