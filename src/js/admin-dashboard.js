import { displayMessage } from './common.js';

const usersTableBody = document.getElementById('usersTableBody');
const adminMessageElement = document.getElementById('adminMessage');

const USER_SITES = [
  { value: 'gaiim', label: 'GAIIM' },
  { value: 'p1a', label: 'P1A' },
];

const SAVE_ICON = `
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M5 3h11l3 3v15H5V3zm3 0v6h8V3H8zm0 18v-7h8v7H8z" />
  </svg>
`;

const DELETE_ICON = `
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M9 3h6l1 2h4v2H4V5h4l1-2zm-1 6h2v8H8V9zm4 0h2v8h-2V9zm4 0h2v8h-2V9zM7 7v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V7H7z" />
  </svg>
`;

function updateSiteSelectAvailability(userId) {
  const roleSelect = document.getElementById(`role-${userId}`);
  const siteSelect = document.getElementById(`site-${userId}`);

  if (!roleSelect || !siteSelect) return;

  const isAdminRole = roleSelect.value === 'admin';

  siteSelect.disabled = isAdminRole;

  if (isAdminRole) {
    siteSelect.value = '';
    return;
  }

  if (!siteSelect.value) {
    siteSelect.value = USER_SITES[0].value;
  }
}

async function fetchUsers() {
  try {
    const response = await fetch('/api/admin/users');
    const data = await response.json();

    if (response.ok) {
      usersTableBody.innerHTML = '';

      if (data.length > 0) {
        data.forEach((user) => {
          const row = usersTableBody.insertRow();

          const cellName = row.insertCell();
          cellName.textContent = user.displayName || user.email;

          const cellRole = row.insertCell();
          const roleSelect = document.createElement('select');
          roleSelect.id = `role-${user.id}`;
          roleSelect.dataset.userid = user.id;
          roleSelect.className = 'user-role-select';

          const optionUser = document.createElement('option');
          optionUser.value = 'user';
          optionUser.textContent = 'Usuario';
          optionUser.selected = user.role === 'user';

          const optionAdmin = document.createElement('option');
          optionAdmin.value = 'admin';
          optionAdmin.textContent = 'Admin';
          optionAdmin.selected = user.role === 'admin';

          roleSelect.appendChild(optionUser);
          roleSelect.appendChild(optionAdmin);
          cellRole.appendChild(roleSelect);

          const cellSite = row.insertCell();
          const siteSelect = document.createElement('select');
          siteSelect.id = `site-${user.id}`;
          siteSelect.dataset.userid = user.id;
          siteSelect.className = 'user-site-select';

          const emptySiteOption = document.createElement('option');
          emptySiteOption.value = '';
          emptySiteOption.textContent = 'Sin sede';
          siteSelect.appendChild(emptySiteOption);

          USER_SITES.forEach((site) => {
            const option = document.createElement('option');
            option.value = site.value;
            option.textContent = site.label;
            option.selected = user.site === site.value;
            siteSelect.appendChild(option);
          });

          siteSelect.value = user.site || '';
          cellSite.appendChild(siteSelect);

          roleSelect.addEventListener('change', () => {
            updateSiteSelectAvailability(user.id);
          });
          updateSiteSelectAvailability(user.id);

          const cellStatus = row.insertCell();
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.id = `isActive-${user.id}`;
          checkbox.dataset.userid = user.id;
          checkbox.checked = user.isActive;

          const label = document.createElement('label');
          label.htmlFor = `isActive-${user.id}`;
          label.className = user.isActive ? 'status-active' : 'status-inactive';
          label.textContent = user.isActive ? 'Activo' : 'Inactivo';

          cellStatus.appendChild(checkbox);
          cellStatus.appendChild(label);

          const cellActions = row.insertCell();
          cellActions.className = 'actions-cell';

          const saveBtn = document.createElement('button');
          saveBtn.type = 'button';
          saveBtn.className = 'save-btn action-btn';
          saveBtn.innerHTML = `${SAVE_ICON}`;
          saveBtn.dataset.userid = user.id;
          saveBtn.addEventListener('click', () => handleUpdateUser(user.id));

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'delete-btn action-btn';
        deleteBtn.innerHTML = `${DELETE_ICON}`;
        deleteBtn.dataset.userid = user.id;
        deleteBtn.dataset.email = user.email;
        deleteBtn.addEventListener('click', () =>
          handleDeleteUser(user.id, user.email),
        );

          cellActions.appendChild(saveBtn);
          cellActions.appendChild(deleteBtn);
        });
      } else {
        const row = usersTableBody.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 5;
        cell.className = 'no-users';
        cell.textContent = 'No hay usuarios registrados.';
      }
    } else {
      console.error('Error fetching users:', data.message);
      displayMessage(
        adminMessageElement,
        data.message || 'Error al cargar usuarios.',
        'error',
      );

      if (response.status === 403 || response.status === 401) {
        setTimeout(() => {
          window.location.href = '/auth/dashboard';
        }, 2000);
      }
    }
  } catch (error) {
    console.error('Network error fetching users:', error);
    displayMessage(
      adminMessageElement,
      'Error de red al cargar usuarios.',
      'error',
    );
  }
}

async function handleUpdateUser(userId) {
  const roleSelect = document.getElementById(`role-${userId}`);
  const siteSelect = document.getElementById(`site-${userId}`);
  const isActiveCheckbox = document.getElementById(`isActive-${userId}`);

  const newRole = roleSelect.value;
  const newSite = siteSelect ? siteSelect.value : '';
  const newIsActive = isActiveCheckbox.checked;

  try {
    const response = await fetch(`/api/admin/users/${userId}/access`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        isActive: newIsActive,
        role: newRole,
        site: newSite,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      displayMessage(adminMessageElement, data.message, 'success');
      fetchUsers();
    } else {
      displayMessage(
        adminMessageElement,
        data.message || 'Error al actualizar usuario.',
        'error',
      );
    }
  } catch (error) {
    console.error('Error updating user:', error);
    displayMessage(adminMessageElement, 'Error de red o del servidor.', 'error');
  }
}

async function handleDeleteUser(userId, userEmail) {
  const confirmDelete = confirm(
    `¿Estás seguro de eliminar al usuario "${userEmail}"? Esta acción no se puede deshacer.`,
  );
  if (!confirmDelete) return;

  try {
    const response = await fetch(`/api/admin/users/${userId}`, {
      method: 'DELETE',
    });

    const data = await response.json();

    if (response.ok) {
      displayMessage(adminMessageElement, data.message, 'success');
      fetchUsers();
    } else {
      displayMessage(adminMessageElement, data.message, 'error');
    }
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    displayMessage(adminMessageElement, 'Error al eliminar usuario.', 'error');
  }
}

document.addEventListener('DOMContentLoaded', fetchUsers);