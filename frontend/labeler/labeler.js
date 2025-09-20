// calc.js - Handles fetching and displaying the BC3 calculation tree

let nodeIdCounter = 0;

async function fetchProcessedFiles() {
  const resp = await fetch('/files/');
  const data = await resp.json();
  return data.processed_files || [];
}

function renderTreeRows(tree, level = 0, parentId = null) {
  if (!tree) return '';
  const thisId = 'node-' + (nodeIdCounter++);
  const hasChildren = tree.children && tree.children.length > 0;
  const rowClass =
    level === 0 ? 'tree-row-root' :
    (tree.concept_type === 'SUBCAPITULO' ? 'tree-row-chapter' :
    (hasChildren ? '' : 'tree-row-leaf'));
  const toggle = hasChildren
    ? `<button class="tree-toggle" data-target="${thisId}" aria-expanded="true" style="margin-right:2px;">&#9660;</button>`
    : '<span style="display:inline-block;width:14px;"></span>';
  // Tooltip for concept_type
  const conceptTypeCell = `<td title="${tree.descriptive_text ? String(tree.descriptive_text).replace(/"/g, '&quot;') : ''}">${tree.concept_type || ''}</td>`;
  let row = `<tr id="${thisId}" class="${rowClass}" data-level="${level}" data-parent="${parentId || ''}">
    <td class="tree-cell" style="padding-left:${(level * 1.5) + 1}em;">${toggle}${tree.code}</td>
    <td>${tree.summary || ''}</td>
    <td>${tree.unit || ''}</td>
    ${conceptTypeCell}
    <td style="text-align:right;">${tree.unit_price.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
    <td style="text-align:right;">${tree.output}</td>
    <td style="text-align:right;">${tree.total_amount.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
  </tr>`;
  if (hasChildren) {
    for (const child of tree.children) {
      row += renderTreeRows(child, level + 1, thisId);
    }
  }
  return row;
}

function setupTreeToggles() {
  document.querySelectorAll('.tree-toggle').forEach(btn => {
    btn.onclick = function() {
      const targetId = btn.getAttribute('data-target');
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!expanded));
      btn.innerHTML = expanded ? '&#9654;' : '&#9660;';
      toggleChildren(targetId, !expanded);
    };
  });
}

function toggleChildren(parentId, show) {
  const rows = document.querySelectorAll(`tr[data-parent='${parentId}']`);
  rows.forEach(row => {
    row.style.display = show ? '' : 'none';
    // If hiding, recursively hide all descendants
    if (!show) {
      const childId = row.id;
      toggleChildren(childId, false);
      // Reset toggle icon
      const btn = row.querySelector('.tree-toggle');
      if (btn) {
        btn.setAttribute('aria-expanded', 'false');
        btn.innerHTML = '&#9654;';
      }
    }
  });
}

async function loadTree() {
  nodeIdCounter = 0;
  const file = document.getElementById('fileSelect').value;
  const msg = document.getElementById('calcMessage');
  const container = document.getElementById('treeContainer');
  msg.textContent = '';
  container.innerHTML = '';
  if (!file) {
    msg.textContent = 'Please select a file.';
    return;
  }
  msg.textContent = 'Loading...';
  try {
    const resp = await fetch(`/calc_tree/${encodeURIComponent(file)}`);
    if (!resp.ok) throw new Error('Failed to fetch calculation tree');
    const data = await resp.json();
    if (!data.tree) throw new Error('No tree data');
    let table = `<table class="tree-table">
      <thead><tr><th>Code</th><th>Summary</th><th>U</th><th>T</th><th>€/U</th><th>Q</th><th>Total</th></tr></thead>
      <tbody>${renderTreeRows(data.tree)}</tbody>
    </table>`;
    container.innerHTML = table;
    // Hide all except root's children
    document.querySelectorAll('tr[data-level]').forEach(row => {
      if (row.getAttribute('data-level') !== '0') {
        row.style.display = '';
      }
    });
    setupTreeToggles();
    msg.textContent = '';
  } catch (e) {
    msg.textContent = 'Error: ' + e.message;
  }
}

async function init() {
  const select = document.getElementById('fileSelect');
  const btn = document.getElementById('loadBtn');
  select.innerHTML = '<option value="">Loading...</option>';
  const files = await fetchProcessedFiles();
  select.innerHTML = '<option value="">-- Select --</option>' +
    files.map(f => `<option value="${f}">${f}</option>`).join('');
  btn.onclick = loadTree;
}

window.addEventListener('DOMContentLoaded', init);
