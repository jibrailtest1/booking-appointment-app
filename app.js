const STORAGE_KEYS = {
  appointments: 'bookingApp.appointments',
  settings: 'bookingApp.settings',
};

const seedAppointments = [
  {
    id: 1,
    name: 'Jordan Lee',
    email: 'jordan@example.com',
    date: '2026-04-14',
    time: '10:00',
    notes: 'Intro call',
  },
  {
    id: 2,
    name: 'Sam Patel',
    email: 'sam@example.com',
    date: '2026-04-15',
    time: '14:30',
    notes: '',
  },
];

export const defaultSettings = {
  demoName: 'Simple scheduling demo',
  introText: 'A lightweight booking flow with a clean form, instant confirmation, and a clear list of upcoming appointments.',
  defaultAppointmentLength: 30,
  bookingNotesEnabled: true,
};

export const formatAppointmentDate = (date, time) => {
  const dateTime = new Date(`${date}T${time}`);

  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(dateTime);
};

export const sortAppointments = (appointments) =>
  [...appointments].sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));

export const normalizeSettings = (settings = {}) => ({
  demoName: typeof settings.demoName === 'string' && settings.demoName.trim() ? settings.demoName.trim() : defaultSettings.demoName,
  introText:
    typeof settings.introText === 'string' && settings.introText.trim() ? settings.introText.trim() : defaultSettings.introText,
  defaultAppointmentLength: Number.isFinite(Number(settings.defaultAppointmentLength)) && Number(settings.defaultAppointmentLength) > 0
    ? Number(settings.defaultAppointmentLength)
    : defaultSettings.defaultAppointmentLength,
  bookingNotesEnabled:
    typeof settings.bookingNotesEnabled === 'boolean' ? settings.bookingNotesEnabled : defaultSettings.bookingNotesEnabled,
});

export const readJsonStorage = (storage, key) => {
  if (!storage?.getItem) {
    return null;
  }

  const raw = storage.getItem(key);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const writeJsonStorage = (storage, key, value) => {
  if (!storage?.setItem) {
    return;
  }

  storage.setItem(key, JSON.stringify(value));
};

export const loadSettings = (storage) => normalizeSettings(readJsonStorage(storage, STORAGE_KEYS.settings) || defaultSettings);

export const loadAppointments = (storage) => {
  const storedAppointments = readJsonStorage(storage, STORAGE_KEYS.appointments);

  return Array.isArray(storedAppointments) ? storedAppointments : [...seedAppointments];
};

export const createAppointmentItemMarkup = (appointment) => {
  const notesMarkup = appointment.notes
    ? `<span class="notes-pill">${appointment.notes}</span>`
    : '';

  return `
    <li class="appointment-item" data-appointment-id="${appointment.id}">
      <div>
        <h3>${appointment.name}</h3>
        <p>${formatAppointmentDate(appointment.date, appointment.time)}</p>
        <p>${appointment.email}</p>
      </div>
      ${notesMarkup}
    </li>
  `;
};

export const createAppointmentItemElement = (doc, appointment) => {
  const item = doc.createElement('li');
  item.className = 'appointment-item';
  item.dataset.appointmentId = String(appointment.id);

  const details = doc.createElement('div');

  const name = doc.createElement('h3');
  name.textContent = appointment.name;

  const date = doc.createElement('p');
  date.textContent = formatAppointmentDate(appointment.date, appointment.time);

  const email = doc.createElement('p');
  email.textContent = appointment.email;

  details.append(name, date, email);
  item.append(details);

  if (appointment.notes) {
    const notes = doc.createElement('span');
    notes.className = 'notes-pill';
    notes.textContent = appointment.notes;
    item.append(notes);
  }

  return item;
};

export const createSuccessMessage = (appointment) =>
  `Appointment booked for ${appointment.name} on ${formatAppointmentDate(appointment.date, appointment.time)}.`;

export function initializeBookingApp(doc = document, options = {}) {
  const storage = options.storage ?? globalThis.localStorage;
  const form = doc.getElementById('booking-form');
  const successMessage = doc.getElementById('success-message');
  const appointmentsList = doc.getElementById('appointments-list');
  const settingsForm = doc.getElementById('settings-form');
  const settingsSuccessMessage = doc.getElementById('settings-success-message');
  const demoNameHeading = doc.getElementById('demo-name');
  const introTextCopy = doc.getElementById('intro-text');
  const settingsDemoNameInput = doc.getElementById('settings-demo-name');
  const settingsIntroTextInput = doc.getElementById('settings-intro-text');
  const settingsAppointmentLengthInput = doc.getElementById('settings-appointment-length');
  const settingsNotesToggle = doc.getElementById('settings-notes-enabled');
  const bookingLengthSummary = doc.getElementById('booking-length-summary');
  const bookingNotesField = doc.getElementById('booking-notes-field');
  const bookingNotesInput = doc.getElementById('booking-notes-input');
  const navButtons = [...doc.querySelectorAll?.('[data-screen-target]') || []];
  const screens = [...doc.querySelectorAll?.('[data-screen]') || []];
  let appointments = loadAppointments(storage);
  let settings = loadSettings(storage);

  const persistAppointments = () => writeJsonStorage(storage, STORAGE_KEYS.appointments, appointments);
  const persistSettings = () => writeJsonStorage(storage, STORAGE_KEYS.settings, settings);

  const renderAppointments = () => {
    appointmentsList.replaceChildren(
      ...sortAppointments(appointments).map((appointment) => createAppointmentItemElement(doc, appointment)),
    );
  };

  const applySettingsToBookingExperience = () => {
    demoNameHeading.textContent = settings.demoName;
    introTextCopy.textContent = settings.introText;
    bookingLengthSummary.textContent = `${settings.defaultAppointmentLength}-minute default appointment`;

    bookingNotesField.classList.toggle('hidden', !settings.bookingNotesEnabled);
    bookingNotesInput.disabled = !settings.bookingNotesEnabled;
    if (!settings.bookingNotesEnabled) {
      bookingNotesInput.value = '';
    }
  };

  const syncSettingsForm = () => {
    settingsDemoNameInput.value = settings.demoName;
    settingsIntroTextInput.value = settings.introText;
    settingsAppointmentLengthInput.value = String(settings.defaultAppointmentLength);
    settingsNotesToggle.checked = settings.bookingNotesEnabled;
  };

  const setActiveScreen = (screenName) => {
    for (const screen of screens) {
      const isActive = screen.dataset.screen === screenName;
      screen.classList.toggle('hidden', !isActive);
    }

    for (const button of navButtons) {
      const isActive = button.dataset.screenTarget === screenName;
      button.classList.toggle('secondary-button', !isActive);
      button.setAttribute('aria-pressed', String(isActive));
    }
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const appointment = {
      id: Date.now(),
      name: String(formData.get('name') || ''),
      email: String(formData.get('email') || ''),
      date: String(formData.get('date') || ''),
      time: String(formData.get('time') || ''),
      notes: settings.bookingNotesEnabled ? String(formData.get('notes') || '') : '',
    };

    appointments = [...appointments, appointment];
    persistAppointments();
    renderAppointments();
    successMessage.textContent = createSuccessMessage(appointment);
    successMessage.classList.remove('hidden');
    form.reset();
    if (!settings.bookingNotesEnabled) {
      bookingNotesInput.value = '';
    }
  });

  settingsForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const formData = new FormData(settingsForm);
    settings = normalizeSettings({
      demoName: String(formData.get('demoName') || ''),
      introText: String(formData.get('introText') || ''),
      defaultAppointmentLength: Number(formData.get('defaultAppointmentLength')),
      bookingNotesEnabled: formData.get('bookingNotesEnabled') === 'on',
    });

    persistSettings();
    applySettingsToBookingExperience();
    syncSettingsForm();
    settingsSuccessMessage.textContent = 'Settings saved successfully.';
    settingsSuccessMessage.classList.remove('hidden');
  });

  for (const button of navButtons) {
    button.addEventListener('click', () => {
      setActiveScreen(button.dataset.screenTarget || 'booking');
    });
  }

  applySettingsToBookingExperience();
  syncSettingsForm();
  renderAppointments();
  setActiveScreen('booking');

  return {
    getAppointments: () => appointments,
    getSettings: () => settings,
    setActiveScreen,
  };
}

if (typeof document !== 'undefined') {
  initializeBookingApp();
}
