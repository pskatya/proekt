const token = localStorage.getItem('token');
if (!token) {
    window.location.href = '/registration.html';
}

// Декодирование токена и извлечение имени пользователя
function getUserFromToken() {
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload;
    } catch (error) {
        console.error('Error decoding token:', error);
        return null;
    }
}

const user = getUserFromToken();
if (user && user.name) {
    document.getElementById('userNotesTitle').textContent = `${user.name}'s notes`;
} else {
    document.getElementById('userNotesTitle').textContent = `Guest's notes`;
}

// Логика выхода
document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('token');
    window.location.href = '/registration.html';
});

// Удаление заметки
async function deleteNote(noteId) {
    const response = await fetch(`/api/notes/${noteId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (response.ok) {
        alert('Note deleted successfully');
        fetchNotes();
    } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.message}`);
    }
}

// Создание заметки
document.getElementById('createNoteBtn').addEventListener('click', async() => {
    const title = document.getElementById('noteTitle').value.trim();
    const content = document.getElementById('noteContent').value.trim();
    const visibility = document.getElementById('noteVisibility').value;
    const tags = document.getElementById('noteTags').value.trim().split(',').map(tag => tag.trim());

    if (!title || !content) {
        alert('Please provide both title and content');
        return;
    }

    const response = await fetch('/api/notes', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ title, content, visibility, tags })
    });

    if (response.ok) {
        alert('Note created successfully');
        fetchNotes();
    } else {
        alert('Error creating note');
    }
});

// Фильтрация заметок по тегам и видимости
document.getElementById('filterBtn').addEventListener('click', () => {
    const filterTag = document.getElementById('filterTag').value.trim();
    const filterVisibility = document.getElementById('filterVisibility').value;
    const tags = filterTag ? filterTag.split(',').map(tag => tag.trim()) : [];
    fetchNotes(tags, filterVisibility);
});

// Получение заметок с фильтрацией по тегам и видимости
async function fetchNotes(tags = [], visibility = '') {
    const response = await fetch(`/api/notes?tag=${tags.join(',')}&visibility=${visibility}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.ok) {
        const notes = await response.json();
        const noteList = document.getElementById('noteList');
        if (notes.length === 0) {
            noteList.innerHTML = '<p>No notes found. Start creating one!</p>';
        } else {
            noteList.innerHTML = notes.map(note => {
                        const canView = note.visibility === 'public' || note.userId._id === user.userId;
                        if (!canView) return '';

                        const canEdit = note.visibility === 'private' && note.userId._id === user.userId;
                        const canDelete = note.userId._id === user.userId;

                        return `
                    <div class="note" id="note-${note._id}">
                        <div class="note-content">
                            <h3>${note.title}</h3>
                            <small>${note.visibility} | Tags: ${note.tags.join(', ')}</small><br>
                            ${note.visibility === 'public' ? `<small><strong>Created by:</strong> ${note.userId.name}</small>` : ''}
                        </div>
                        <p>${note.content}</p>
                        ${canEdit ? `<button class="editNoteBtn" data-id="${note._id}">✏️</button>` : ''}
                        ${canDelete ? `<button class="deleteNoteBtn" data-id="${note._id}">🗑️</button>` : ''}
                    </div>
                `;
            }).join('');

            attachEditDeleteHandlers();
        }
    } else {
        alert('Error fetching notes');
    }
}

// Функция для добавления обработчиков кнопок редактирования и удаления
function attachEditDeleteHandlers() {
    const editButtons = document.querySelectorAll('.editNoteBtn');
    editButtons.forEach(button => {
        button.addEventListener('click', async (e) => {
            const noteId = e.target.getAttribute('data-id');
            await editNoteForm(noteId); // Показать форму редактирования
        });
    });

    const deleteButtons = document.querySelectorAll('.deleteNoteBtn');
    deleteButtons.forEach(button => {
        button.addEventListener('click', async (e) => {
            const noteId = e.target.getAttribute('data-id');
            await deleteNote(noteId);
            document.getElementById(`note-${noteId}`).remove(); 
        });
    });
}

// Функция для редактирования заметки
async function editNoteForm(noteId) {
    const response = await fetch(`/api/notes/${noteId}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) {
        const errorData = await response.json();
        alert(`Error: ${errorData.message}`);
        return;
    }

    const note = await response.json();

    if (note) {
        const noteDiv = document.getElementById(`note-${noteId}`);
        const noteContentDiv = noteDiv.querySelector('.note-content');
        const noteTextDiv = noteDiv.querySelector('p');
        const editButtons = noteDiv.querySelectorAll('.editNoteBtn');
        const deleteButtons = noteDiv.querySelectorAll('.deleteNoteBtn');

        noteTextDiv.style.display = 'none';
        editButtons.forEach(button => button.style.display = 'none');
        deleteButtons.forEach(button => button.style.display = 'none');
        noteContentDiv.innerHTML = `
            <input type="text" id="editNoteTitle" value="${note.title}" placeholder="Note title" />
            <textarea id="editNoteContent" placeholder="Note content">${note.content}</textarea>
            <input type="text" id="editNoteTags" value="${note.tags.join(', ')}" placeholder="Tags (comma-separated)" />
            <select id="editNoteVisibility">
                <option value="public" ${note.visibility === 'public' ? 'selected' : ''}>Public</option>
                <option value="private" ${note.visibility === 'private' ? 'selected' : ''}>Private</option>
            </select>
            <button id="saveNoteBtn">Save Changes</button>
            <button id="cancelEditBtn">Cancel</button>
        `;
        document.getElementById('saveNoteBtn').addEventListener('click', async () => {
            const title = document.getElementById('editNoteTitle').value.trim();
            const content = document.getElementById('editNoteContent').value.trim();
            const tags = document.getElementById('editNoteTags').value.trim().split(',').map(tag => tag.trim());
            const visibility = document.getElementById('editNoteVisibility').value;

            if (!title || !content) {
                alert('Please provide both title and content');
                return;
            }

            const updateResponse = await fetch(`/api/notes/${noteId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ title, content, visibility, tags })
            });

            if (updateResponse.ok) {
                alert('Note updated successfully');
                fetchNotes(); 
            } else {
                const errorData = await updateResponse.json();
                alert(`Error: ${errorData.message}`);
            }
        });

        document.getElementById('cancelEditBtn').addEventListener('click', () => {
            fetchNotes(); 
        });
    }
}

fetchNotes();