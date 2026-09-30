const STORAGE_KEY = 'daily-list-widget-v1';
const $ = (selector) => document.querySelector(selector);

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const shiftDate = (key, days) => {
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(year, month - 1, day + days);
  return dateKey(date);
};

const dateKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const dateFromKey = (key) => {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
};

let data = load();
let collapsed = false;
let pinned = false;
let viewDay = todayKey();
let currentSystemDay = todayKey();
let calendarProjectId = null;
let calendarMonthDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let calendarSelectedDay = todayKey();
let pointerDrag = null;

function load() {
  try {
    const fileData = window.desktop?.loadData();
    const stored = fileData?.days ? fileData : JSON.parse(localStorage.getItem(STORAGE_KEY));
    const result = stored || { days: {}, carryPromptedFor: null };
    result.days ||= {};
    result.projects ||= [];
    return result;
  } catch {
    return { days: {}, projects: [], carryPromptedFor: null };
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  window.desktop?.saveData(data);
}

function tasks(day = viewDay) {
  return data.days[day] || (data.days[day] = []);
}

function projectById(id) {
  return data.projects.find((project) => project.id === id);
}

function performDailyRollover() {
  data.days[todayKey()] ||= [];
  save();
}

function getCarryCandidates() {
  if (data.carryPromptedFor === todayKey()) return [];
  return (data.days[shiftDate(todayKey(), -1)] || []).filter((task) => {
    const project = task.projectId ? projectById(task.projectId) : null;
    return !task.done && !project?.done;
  });
}

function renderDate() {
  const shown = dateFromKey(viewDay);
  const isTomorrow = viewDay === shiftDate(todayKey(), 1);
  $('#weekday').textContent = isTomorrow
    ? '提前计划 · 明天'
    : new Intl.DateTimeFormat('zh-CN', { weekday: 'long' }).format(shown);
  $('#dateTitle').textContent = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric' }).format(shown);
  $('#listDayLabel').textContent = isTomorrow ? '明天' : '今天';
  $('#taskInput').placeholder = isTomorrow ? '添加明天要做的事…' : '添加今天要做的事…';
}

function projectProgress(projectId) {
  const all = Object.values(data.days).flat().filter((task) => task.projectId === projectId);
  const done = all.filter((task) => task.done).length;
  return { all: all.length, done };
}

function startProjectEditing(card, project) {
  if (card.classList.contains('editing')) return;
  card.classList.add('editing');
  const input = document.createElement('input');
  input.className = 'project-edit-input';
  input.maxLength = 40;
  input.value = project.name;
  input.setAttribute('aria-label', '编辑长期项目名称');
  card.querySelector('.project-main strong').replaceWith(input);
  input.focus();
  input.select();
}

function finishProjectEditing(input, saveChanges) {
  const card = input.closest('.project-card');
  const project = projectById(card?.dataset.projectId);
  if (!project) return render();
  const name = input.value.trim();
  if (saveChanges && name) project.name = name;
  render();
}

function renderProjects() {
  const activeCount = data.projects.filter((project) => !project.done).length;
  const completedCount = data.projects.length - activeCount;
  $('#projectSummary').textContent = data.projects.length
    ? `${activeCount} 个进行中${completedCount ? ` · ${completedCount} 个完成` : ''}`
    : '点击创建';
  $('#projectList').innerHTML = data.projects.map((project) => {
    const progress = projectProgress(project.id);
    const percentage = progress.all ? Math.round(progress.done / progress.all * 100) : 0;
    return `<article class="project-card ${project.done ? 'completed' : ''}" data-project-id="${project.id}">
      <button class="project-check" title="${project.done ? '恢复项目' : '完成项目'}" aria-label="${project.done ? '恢复项目' : '完成项目'}">${project.done ? '✓' : ''}</button>
      <div class="project-main">
        <strong class="project-name" title="双击修改名称">${escapeHtml(project.name)}</strong>
        <span>${project.done ? '已完成' : `${progress.done}/${progress.all} 项 · ${percentage}%`}</span>
        <i><b style="width:${percentage}%"></b></i>
      </div>
      <button class="project-edit" title="编辑项目名称" aria-label="编辑项目名称"><svg viewBox="0 0 24 24"><path d="m4 20 4.2-1 10.6-10.6a2 2 0 0 0-2.8-2.8L5.4 16.2 4 20Z"/><path d="m14.5 7.1 2.8 2.8"/></svg></button>
      <button class="project-calendar" title="项目日历" aria-label="项目日历"><svg viewBox="0 0 24 24"><path d="M5 4v3m14-3v3M4 9h16M5 6h14a1 1 0 0 1 1 1v12H4V7a1 1 0 0 1 1-1Z"/></svg></button>
      ${project.done ? '<button class="project-delete" title="删除项目和日历" aria-label="删除项目和日历">×</button>' : ''}
    </article>`;
  }).join('') || '<p class="no-projects">还没有长期项目</p>';

  const selected = $('#projectSelect').value;
  $('#projectSelect').innerHTML = '<option value="">日常事项</option>' +
    data.projects.filter((project) => !project.done)
      .map((project) => `<option value="${project.id}">${escapeHtml(project.name)}</option>`).join('');
  if ([...$('#projectSelect').options].some((option) => option.value === selected)) {
    $('#projectSelect').value = selected;
  }
  renderProjectPicker();
}

function renderProjectPicker() {
  const selectedId = $('#projectSelect').value;
  const selectedProject = projectById(selectedId);
  $('#projectPickerLabel').textContent = selectedProject?.name || '日常事项';
  const dailyIcon = '<svg viewBox="0 0 24 24"><path d="M5 6h14M5 12h14M5 18h9"/></svg>';
  const projectIcon = '<svg viewBox="0 0 24 24"><path d="M4 7h6l2 2h8v10H4V7Z"/></svg>';
  const options = [
    { id: '', name: '日常事项', icon: dailyIcon },
    ...data.projects.filter((project) => !project.done).map((project) => ({ id: project.id, name: project.name, icon: projectIcon }))
  ];
  $('#projectPickerMenu').innerHTML = options.map((option) =>
    `<button type="button" class="project-picker-option ${option.id === selectedId ? 'selected' : ''}" data-project-value="${option.id}" role="option" aria-selected="${option.id === selectedId}">
      ${option.icon}<span>${escapeHtml(option.name)}</span><i></i>
    </button>`
  ).join('');
}

function closeProjectPicker() {
  $('#projectPickerMenu').classList.add('hidden');
  $('#projectPickerButton').setAttribute('aria-expanded', 'false');
}

function priorityForIndex(index) {
  if (index === 0) return { level: 'highest', label: '最高优先级' };
  if (index === 1) return { level: 'high', label: '高优先级' };
  if (index === 2) return { level: 'medium', label: '中优先级' };
  return { level: 'normal', label: '普通优先级' };
}

function taskMarkup(task, priorityIndex) {
  const priority = priorityForIndex(priorityIndex);
  return `<div class="task ${task.done ? 'done' : ''} priority-${priority.level}" data-id="${task.id}" data-project-id="${task.projectId || ''}">
    <span class="priority-color" title="${priority.label}"></span><button class="drag-handle" type="button" title="按住并上下拖动调整优先级" aria-label="按住并上下拖动调整优先级"><svg viewBox="0 0 24 24"><path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01"/></svg></button>
    <input class="check" type="checkbox" ${task.done ? 'checked' : ''} aria-label="完成">
    <span class="task-text" title="双击编辑">${escapeHtml(task.text)}</span>
    <button class="edit" title="编辑" aria-label="编辑"><svg viewBox="0 0 24 24"><path d="m4 20 4.2-1 10.6-10.6a2 2 0 0 0-2.8-2.8L5.4 16.2 4 20Z"/><path d="m14.5 7.1 2.8 2.8"/></svg></button>
    <button class="delete" title="删除" aria-label="删除">×</button>
  </div>`;
}

function renderTaskGroups() {
  const list = tasks();
  const activeProjects = data.projects.filter((project) => !project.done);
  const completedProjectIds = new Set(data.projects.filter((project) => project.done).map((project) => project.id));
  const sections = activeProjects.map((project) => {
    const items = list.filter((task) => task.projectId === project.id);
    return `<section class="task-group ${items.length ? '' : 'empty-group'}">
      <div class="task-group-head"><span class="project-dot"></span><strong>${escapeHtml(project.name)}</strong><small>${items.length} 项</small></div>
      <div class="task-group-items" data-project-id="${project.id}">${items.map((task, index) => taskMarkup(task, index)).join('') || '<p>今天还没有安排</p>'}</div>
    </section>`;
  });
  const daily = list.filter((task) => !task.projectId || (!projectById(task.projectId) && !completedProjectIds.has(task.projectId)));
  sections.push(`<section class="task-group daily-group">
    <div class="task-group-head"><span class="daily-dot"></span><strong>日常事项</strong><small>${daily.length} 项</small></div>
    <div class="task-group-items" data-project-id="">${daily.map((task, index) => taskMarkup(task, index)).join('') || '<p>今天还没有安排</p>'}</div>
  </section>`);
  $('#taskList').innerHTML = sections.join('');
}

function reorderProjectTasks(projectId, draggedId, targetId, placeAfter) {
  if (draggedId === targetId) return;
  const dayTasks = tasks();
  const belongsToGroup = (task) => (task.projectId || '') === projectId;
  const projectItems = dayTasks.filter(belongsToGroup);
  const moving = projectItems.find((task) => task.id === draggedId);
  if (!moving) return;
  const ordered = projectItems.filter((task) => task.id !== draggedId);
  const targetIndex = ordered.findIndex((task) => task.id === targetId);
  if (targetIndex < 0) return;
  ordered.splice(targetIndex + (placeAfter ? 1 : 0), 0, moving);
  let index = 0;
  data.days[viewDay] = dayTasks.map((task) => belongsToGroup(task) ? ordered[index++] : task);
  render();
}

function clearDragState() {
  document.querySelectorAll('.task.dragging, .task.drop-before, .task.drop-after').forEach((row) => {
    row.classList.remove('dragging', 'drop-before', 'drop-after');
  });
  pointerDrag?.ghost?.remove();
  document.body.classList.remove('reordering-tasks');
  pointerDrag = null;
}

function activatePointerDrag() {
  if (!pointerDrag || pointerDrag.active) return;
  pointerDrag.active = true;
  pointerDrag.row.classList.add('dragging');
  const ghost = pointerDrag.row.cloneNode(true);
  ghost.classList.remove('dragging', 'drop-before', 'drop-after');
  ghost.classList.add('task-drag-ghost');
  ghost.style.width = `${pointerDrag.rect.width}px`;
  ghost.style.left = `${pointerDrag.rect.left}px`;
  ghost.style.top = `${pointerDrag.startY - pointerDrag.offsetY}px`;
  document.body.appendChild(ghost);
  pointerDrag.ghost = ghost;
  document.body.classList.add('reordering-tasks');
}

function startTaskReorder(row, event) {
  if (!row) return;
  clearDragState();
  const rect = row.getBoundingClientRect();
  pointerDrag = {
    pointerId: null,
    id: row.dataset.id,
    projectId: row.dataset.projectId,
    row,
    startX: event.clientX,
    startY: event.clientY,
    offsetY: rect.height / 2,
    rect,
    active: false,
    ghost: null,
    target: null,
    placeAfter: false
  };
  activatePointerDrag();
}

function prepareTaskDrag(row, handle, event) {
  if (!row || event.button !== 0) return;
  clearDragState();
  const rect = row.getBoundingClientRect();
  pointerDrag = {
    pointerId: event.pointerId,
    id: row.dataset.id,
    projectId: row.dataset.projectId,
    row,
    startX: event.clientX,
    startY: event.clientY,
    offsetY: event.clientY - rect.top,
    rect,
    active: false,
    ghost: null,
    target: null,
    placeAfter: false
  };
  handle.setPointerCapture?.(event.pointerId);
}

function renderCarry() {
  if (viewDay !== todayKey()) {
    $('#carryPanel').classList.add('hidden');
    return;
  }
  const candidates = getCarryCandidates();
  $('#carryPanel').classList.toggle('hidden', !candidates.length);
  $('#carryList').innerHTML = candidates.map((task) => {
    const project = projectById(task.projectId);
    return `<div class="carry-item"><span>${project ? `<small>${escapeHtml(project.name)}</small>` : ''}${escapeHtml(task.text)}</span><button data-carry="${task.id}">加入今天</button></div>`;
  }).join('');
}

function render() {
  const list = tasks();
  renderProjects();
  renderTaskGroups();
  $('#emptyState').classList.toggle('hidden', list.length > 0 || data.projects.some((project) => !project.done));
  $('#clearDone').classList.toggle('hidden', !list.some((task) => task.done && !task.projectId));
  $('#taskCount').textContent = `${list.length} 项`;
  const percentage = list.length ? Math.round(list.filter((task) => task.done).length / list.length * 100) : 0;
  $('#progressText').textContent = `${percentage}%`;
  $('#progressRing').style.setProperty('--p', `${percentage}%`);
  renderCarry();
  save();
}

function startEditing(row, item) {
  if (row.classList.contains('editing')) return;
  row.classList.add('editing');
  const input = document.createElement('textarea');
  input.className = 'task-edit-input';
  input.maxLength = 240;
  input.rows = 1;
  input.value = item.text;
  input.setAttribute('aria-label', '编辑待办事项');
  row.querySelector('.task-text').replaceWith(input);
  resizeTextarea(input);
  input.focus();
  input.select();
}

function resizeTextarea(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = `${textarea.scrollHeight}px`;
}

function finishEditing(input, saveChanges) {
  const row = input.closest('.task');
  const item = tasks().find((task) => task.id === row?.dataset.id);
  if (!item) return render();
  const text = input.value.trim();
  if (saveChanges && text) item.text = text;
  render();
}

function escapeHtml(value) {
  const node = document.createElement('div');
  node.textContent = value ?? '';
  return node.innerHTML;
}

function selectDay(tomorrow) {
  viewDay = tomorrow ? shiftDate(todayKey(), 1) : todayKey();
  document.querySelectorAll('.day-tab').forEach((button) => {
    button.classList.toggle('active', button.dataset.view === (tomorrow ? 'tomorrow' : 'today'));
  });
  $('.day-switch').classList.toggle('tomorrow', tomorrow);
  renderDate();
  render();
}

function projectTasksForDay(projectId, day) {
  return (data.days[day] || []).filter((task) => task.projectId === projectId);
}

function projectLifecycle(project) {
  return {
    start: dateKey(new Date(project.createdAt || Date.now())),
    end: project.completedAt ? dateKey(new Date(project.completedAt)) : null
  };
}

function renderCalendar() {
  const project = projectById(calendarProjectId);
  if (!project) return closeCalendar();
  $('#calendarProjectName').textContent = project.name;
  $('#calendarMonth').textContent = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long' }).format(calendarMonthDate);
  const year = calendarMonthDate.getFullYear();
  const month = calendarMonthDate.getMonth();
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leading = (first.getDay() + 6) % 7;
  let cells = '<span class="calendar-blank"></span>'.repeat(leading);
  for (let day = 1; day <= daysInMonth; day += 1) {
    const key = dateKey(new Date(year, month, day));
    const items = projectTasksForDay(project.id, key);
    const done = items.filter((task) => task.done).length;
    const lifecycle = projectLifecycle(project);
    const inProject = key >= lifecycle.start && (!lifecycle.end || key <= lifecycle.end);
    const previews = items.slice(0, 2).map((task) =>
      `<em class="${task.done ? 'done' : ''}" title="${escapeHtml(task.text)}"><b>${task.done ? '✓' : '○'}</b>${escapeHtml(task.text)}</em>`
    ).join('');
    cells += `<button class="calendar-day ${key === calendarSelectedDay ? 'selected' : ''} ${items.length ? 'has-work' : ''} ${inProject ? 'in-project' : 'outside-project'}" data-day="${key}">
      <span class="calendar-day-number">${day}</span>${items.length ? `<small>${done}/${items.length}</small><span class="calendar-tasks">${previews}${items.length > 2 ? `<i>+${items.length - 2}</i>` : ''}</span>` : ''}
    </button>`;
  }
  $('#calendarGrid').innerHTML = cells;
}

function renderCalendarDetails() {
  const items = projectTasksForDay(calendarProjectId, calendarSelectedDay);
  const dateLabel = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' }).format(dateFromKey(calendarSelectedDay));
  const doneCount = items.filter((task) => task.done).length;
  $('#dayDetailsTitle').textContent = `${dateLabel} · ${doneCount}/${items.length} 项完成`;
  $('#calendarDetails').innerHTML = items.length
    ? `<ul>${items.map((task) => `<li class="${task.done ? 'done' : ''}"><span>${task.done ? '✓' : '○'}</span>${escapeHtml(task.text)}</li>`).join('')}</ul>`
    : '<p>这一天没有项目事项</p>';
  $('#dayDetailsModal').classList.remove('hidden');
}

function openCalendar(projectId) {
  calendarProjectId = projectId;
  calendarSelectedDay = todayKey();
  calendarMonthDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  $('#dayDetailsModal').classList.add('hidden');
  $('#calendarModal').classList.remove('hidden');
  renderCalendar();
}

function closeCalendar() {
  calendarProjectId = null;
  $('#dayDetailsModal').classList.add('hidden');
  $('#calendarModal').classList.add('hidden');
}

$('#projectForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const name = $('#projectInput').value.trim();
  if (!name) return;
  const project = { id: crypto.randomUUID(), name, done: false, createdAt: Date.now(), completedAt: null };
  data.projects.push(project);
  $('#projectInput').value = '';
  $('#projectForm').classList.add('hidden');
  render();
  $('#projectSelect').value = project.id;
  renderProjectPicker();
  $('#taskInput').focus();
});

$('#toggleProjectForm').onclick = () => {
  $('#projectForm').classList.toggle('hidden');
  if (!$('#projectForm').classList.contains('hidden')) $('#projectInput').focus();
};

$('#toggleProjects').onclick = () => {
  const opening = $('#projectsBody').classList.contains('hidden');
  $('#projectsBody').classList.toggle('hidden', !opening);
  $('#toggleProjects').setAttribute('aria-expanded', String(opening));
};

$('#projectList').addEventListener('click', (event) => {
  const card = event.target.closest('.project-card');
  if (!card) return;
  const project = projectById(card.dataset.projectId);
  if (!project) return;
  if (event.target.closest('.project-edit')) {
    return startProjectEditing(card, project);
  }
  if (event.target.matches('.project-edit-input')) return;
  if (event.target.closest('.project-calendar')) return openCalendar(project.id);
  if (event.target.closest('.project-check')) {
    project.done = !project.done;
    project.completedAt = project.done ? Date.now() : null;
    return render();
  }
  if (event.target.closest('.project-delete')) {
    if (!confirm(`删除“${project.name}”？该项目的日历和所有历史事项也会永久删除。`)) return;
    data.projects = data.projects.filter((item) => item.id !== project.id);
    Object.keys(data.days).forEach((day) => {
      data.days[day] = data.days[day].filter((task) => task.projectId !== project.id);
    });
    render();
  }
});

$('#projectList').addEventListener('keydown', (event) => {
  if (!event.target.matches('.project-edit-input')) return;
  if (event.key === 'Enter') {
    event.preventDefault();
    finishProjectEditing(event.target, true);
  }
  if (event.key === 'Escape') finishProjectEditing(event.target, false);
});

$('#projectList').addEventListener('dblclick', (event) => {
  const name = event.target.closest('.project-name');
  if (!name) return;
  const card = name.closest('.project-card');
  const project = projectById(card?.dataset.projectId);
  if (project) startProjectEditing(card, project);
});

$('#projectList').addEventListener('focusout', (event) => {
  if (event.target.matches('.project-edit-input')) finishProjectEditing(event.target, true);
});

$('#projectPickerButton').onclick = () => {
  const opening = $('#projectPickerMenu').classList.contains('hidden');
  $('#projectPickerMenu').classList.toggle('hidden', !opening);
  $('#projectPickerButton').setAttribute('aria-expanded', String(opening));
};

$('#projectPickerMenu').addEventListener('click', (event) => {
  const option = event.target.closest('.project-picker-option');
  if (!option) return;
  $('#projectSelect').value = option.dataset.projectValue;
  renderProjectPicker();
  closeProjectPicker();
  $('#taskInput').focus();
});

document.addEventListener('click', (event) => {
  if (!event.target.closest('.project-picker')) closeProjectPicker();
});

$('#taskForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const text = $('#taskInput').value.trim();
  if (!text) return;
  const projectId = $('#projectSelect').value || null;
  tasks().push({ id: crypto.randomUUID(), projectId, text, done: false, createdAt: Date.now() });
  $('#taskInput').value = '';
  resizeTextarea($('#taskInput'));
  render();
});

document.addEventListener('pointermove', (event) => {
  if (!pointerDrag) return;
  if (pointerDrag.pointerId !== null && event.pointerId !== pointerDrag.pointerId) return;
  if (!pointerDrag.active) {
    const distance = Math.hypot(
      event.clientX - pointerDrag.startX,
      event.clientY - pointerDrag.startY
    );
    if (distance < 3) return;
    activatePointerDrag();
  }
  event.preventDefault();
  pointerDrag.ghost.style.top = `${event.clientY - pointerDrag.offsetY}px`;

  const content = $('.content');
  const contentRect = content.getBoundingClientRect();
  if (event.clientY < contentRect.top + 42) content.scrollTop -= 12;
  if (event.clientY > contentRect.bottom - 42) content.scrollTop += 12;

  document.querySelectorAll('.task.drop-before, .task.drop-after').forEach((item) => {
    item.classList.remove('drop-before', 'drop-after');
  });
  const group = pointerDrag.row.closest('.task-group-items');
  const candidates = [...group.querySelectorAll('.task')].filter((row) => row.dataset.id !== pointerDrag.id);
  if (!candidates.length) {
    pointerDrag.target = null;
    return;
  }
  let target = candidates[candidates.length - 1];
  let placeAfter = true;
  for (const candidate of candidates) {
    const rect = candidate.getBoundingClientRect();
    if (event.clientY < rect.top + rect.height / 2) {
      target = candidate;
      placeAfter = false;
      break;
    }
  }
  pointerDrag.target = target;
  pointerDrag.placeAfter = placeAfter;
  target.classList.add(placeAfter ? 'drop-after' : 'drop-before');
});

document.addEventListener('pointerup', (event) => {
  if (!pointerDrag || pointerDrag.pointerId === null || event.pointerId !== pointerDrag.pointerId) return;
  if (!pointerDrag.active) {
    clearDragState();
    return;
  }
  const { projectId, id, target, placeAfter } = pointerDrag;
  if (target) reorderProjectTasks(projectId, id, target.dataset.id, placeAfter);
  clearDragState();
});

document.addEventListener('pointercancel', () => {
  document.body.classList.remove('reordering-tasks');
  clearDragState();
});

$('#taskInput').addEventListener('input', (event) => resizeTextarea(event.target));
$('#taskInput').addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && event.shiftKey) {
    event.preventDefault();
    $('#taskForm').requestSubmit();
  }
});

$('#taskList').addEventListener('click', (event) => {
  const row = event.target.closest('.task');
  if (!row) return;
  const item = tasks().find((task) => task.id === row.dataset.id);
  if (!item) return;
  if (event.target.closest('.drag-handle')) return;
  if (event.target.matches('.check')) {
    item.done = event.target.checked;
    return render();
  }
  if (event.target.matches('.delete')) {
    data.days[viewDay] = tasks().filter((task) => task.id !== item.id);
    return render();
  }
  if (event.target.closest('.edit')) return startEditing(row, item);
  if (event.target.matches('.task-edit-input')) return;
});

$('#taskList').addEventListener('pointerdown', (event) => {
  const handle = event.target.closest('.drag-handle');
  if (!handle) return;
  event.preventDefault();
  prepareTaskDrag(handle.closest('.task'), handle, event);
});

$('#taskList').addEventListener('dblclick', (event) => {
  const handle = event.target.closest('.drag-handle');
  if (handle) {
    event.preventDefault();
    event.stopPropagation();
    startTaskReorder(handle.closest('.task'), event);
    return;
  }
  const text = event.target.closest('.task-text');
  if (!text) return;
  const row = text.closest('.task');
  const item = tasks().find((task) => task.id === row.dataset.id);
  if (item) startEditing(row, item);
});

$('#taskList').addEventListener('click', (event) => {
  if (!pointerDrag?.active || pointerDrag.pointerId !== null) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const clickedRow = event.target.closest('.task');
  const validClickedRow = clickedRow &&
    clickedRow.dataset.projectId === pointerDrag.projectId &&
    clickedRow.dataset.id !== pointerDrag.id;
  const target = validClickedRow ? clickedRow : pointerDrag.target;
  if (target) {
    const rect = target.getBoundingClientRect();
    const placeAfter = validClickedRow
      ? event.clientY > rect.top + rect.height / 2
      : pointerDrag.placeAfter;
    reorderProjectTasks(
      pointerDrag.projectId,
      pointerDrag.id,
      target.dataset.id,
      placeAfter
    );
  }
  clearDragState();
}, true);

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && pointerDrag?.active) clearDragState();
});

$('#taskList').addEventListener('keydown', (event) => {
  if (!event.target.matches('.task-edit-input')) return;
  if (event.key === 'Enter' && event.shiftKey) {
    event.preventDefault();
    finishEditing(event.target, true);
  }
  if (event.key === 'Escape') finishEditing(event.target, false);
});

$('#taskList').addEventListener('input', (event) => {
  if (event.target.matches('.task-edit-input')) resizeTextarea(event.target);
});

$('#taskList').addEventListener('focusout', (event) => {
  if (event.target.matches('.task-edit-input')) finishEditing(event.target, true);
});

$('#carryList').addEventListener('click', (event) => {
  const id = event.target.dataset.carry;
  if (!id) return;
  const yesterday = shiftDate(todayKey(), -1);
  const old = (data.days[yesterday] || []).find((task) => task.id === id);
  if (old) tasks(todayKey()).push({ ...old, id: crypto.randomUUID(), createdAt: Date.now(), carried: true });
  data.days[yesterday] = (data.days[yesterday] || []).filter((task) => task.id !== id);
  if (!getCarryCandidates().length) data.carryPromptedFor = todayKey();
  render();
});

$('.day-switch').addEventListener('click', (event) => {
  const tab = event.target.closest('.day-tab');
  if (!tab) return;
  selectDay(tab.dataset.view === 'tomorrow');
  $('#taskInput').focus();
});

$('#calendarGrid').addEventListener('click', (event) => {
  const day = event.target.closest('.calendar-day')?.dataset.day;
  if (!day) return;
  calendarSelectedDay = day;
  renderCalendar();
  renderCalendarDetails();
});
$('#prevMonth').onclick = () => {
  calendarMonthDate = new Date(calendarMonthDate.getFullYear(), calendarMonthDate.getMonth() - 1, 1);
  renderCalendar();
};
$('#nextMonth').onclick = () => {
  calendarMonthDate = new Date(calendarMonthDate.getFullYear(), calendarMonthDate.getMonth() + 1, 1);
  renderCalendar();
};
$('#closeCalendar').onclick = closeCalendar;
$('#closeDayDetails').onclick = () => $('#dayDetailsModal').classList.add('hidden');
$('#dayDetailsModal').addEventListener('click', (event) => {
  if (event.target === $('#dayDetailsModal')) $('#dayDetailsModal').classList.add('hidden');
});
$('#calendarModal').addEventListener('click', (event) => {
  if (event.target === $('#calendarModal')) closeCalendar();
});

$('#dismissCarry').onclick = () => { data.carryPromptedFor = todayKey(); render(); };
$('#clearDone').onclick = () => {
  data.days[viewDay] = tasks().filter((task) => task.projectId || !task.done);
  render();
};
$('#minBtn').onclick = () => window.desktop.minimize();
$('#closeBtn').onclick = () => window.desktop.close();
$('#collapseBtn').onclick = () => {
  collapsed = !collapsed;
  $('.content').classList.toggle('hidden', collapsed);
  $('#collapseBtn').innerHTML = collapsed
    ? '<svg viewBox="0 0 24 24"><path d="m7 10 5 5 5-5"/></svg>'
    : '<svg viewBox="0 0 24 24"><path d="m7 14 5-5 5 5"/></svg>';
  window.desktop.collapse(collapsed);
};
$('#pinBtn').onclick = async () => {
  pinned = !pinned;
  await window.desktop.pin(pinned);
  $('#pinBtn').classList.toggle('active', pinned);
};

performDailyRollover();
renderDate();
render();

setInterval(() => {
  if (todayKey() === currentSystemDay) return;
  currentSystemDay = todayKey();
  performDailyRollover();
  selectDay(false);
}, 60000);
