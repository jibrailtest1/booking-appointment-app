import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAppointmentItemElement,
  createAppointmentItemMarkup,
  createSuccessMessage,
  defaultSettings,
  formatAppointmentDate,
  initializeBookingApp,
  loadSettings,
  normalizeSettings,
  sortAppointments,
} from './app.js';

test('formatAppointmentDate returns a readable date string', () => {
  const formatted = formatAppointmentDate('2026-04-18', '09:45');

  assert.match(formatted, /Apr/);
  assert.match(formatted, /9:45/);
});

test('sortAppointments orders appointments chronologically', () => {
  const sorted = sortAppointments([
    { id: 2, name: 'Later', email: 'later@example.com', date: '2026-04-20', time: '12:00', notes: '' },
    { id: 1, name: 'Sooner', email: 'sooner@example.com', date: '2026-04-18', time: '09:00', notes: '' },
  ]);

  assert.equal(sorted[0].name, 'Sooner');
  assert.equal(sorted[1].name, 'Later');
});

test('normalizeSettings fills missing values with defaults', () => {
  const settings = normalizeSettings({
    demoName: '  Demo HQ  ',
    bookingNotesEnabled: false,
  });

  assert.equal(settings.demoName, 'Demo HQ');
  assert.equal(settings.introText, defaultSettings.introText);
  assert.equal(settings.defaultAppointmentLength, defaultSettings.defaultAppointmentLength);
  assert.equal(settings.bookingNotesEnabled, false);
});

test('normalizeSettings enforces the same appointment length rules as the form UI', () => {
  assert.equal(normalizeSettings({ defaultAppointmentLength: 5 }).defaultAppointmentLength, 5);
  assert.equal(normalizeSettings({ defaultAppointmentLength: 45 }).defaultAppointmentLength, 45);
  assert.equal(normalizeSettings({ defaultAppointmentLength: 0 }).defaultAppointmentLength, defaultSettings.defaultAppointmentLength);
  assert.equal(normalizeSettings({ defaultAppointmentLength: 7 }).defaultAppointmentLength, defaultSettings.defaultAppointmentLength);
  assert.equal(normalizeSettings({ defaultAppointmentLength: 12.5 }).defaultAppointmentLength, defaultSettings.defaultAppointmentLength);
});

test('loadSettings falls back when storage is empty or invalid', () => {
  const emptyStorage = { getItem: () => null };
  const invalidStorage = { getItem: () => '{bad json' };

  assert.deepEqual(loadSettings(emptyStorage), defaultSettings);
  assert.deepEqual(loadSettings(invalidStorage), defaultSettings);
});

test('createSuccessMessage includes the booked person and slot', () => {
  const message = createSuccessMessage({
    id: 3,
    name: 'Taylor Brooks',
    email: 'taylor@example.com',
    date: '2026-04-18',
    time: '09:45',
    notes: 'First consultation',
  });

  assert.match(message, /Taylor Brooks/);
  assert.match(message, /Appointment booked/);
});

test('createAppointmentItemMarkup includes notes when present', () => {
  const markup = createAppointmentItemMarkup({
    id: 3,
    name: 'Taylor Brooks',
    email: 'taylor@example.com',
    date: '2026-04-18',
    time: '09:45',
    notes: 'First consultation',
  });

  assert.match(markup, /Taylor Brooks/);
  assert.match(markup, /First consultation/);
  assert.match(markup, /notes-pill/);
});

test('createAppointmentItemElement renders appointment fields safely as text', () => {
  const doc = {
    createElement(tagName) {
      return {
        tagName,
        className: '',
        dataset: {},
        textContent: '',
        children: [],
        append(...children) {
          this.children.push(...children);
        },
      };
    },
  };

  const item = createAppointmentItemElement(doc, {
    id: 7,
    name: '<img src=x onerror=alert(1)>',
    email: 'safe@example.com',
    date: '2026-04-18',
    time: '09:45',
    notes: '<script>alert(1)</script>',
  });

  assert.equal(item.children[0].children[0].textContent, '<img src=x onerror=alert(1)>');
  assert.equal(item.children[1].textContent, '<script>alert(1)</script>');
});

test('initializeBookingApp safely supports pages without settings-specific DOM', () => {
  class FakeClassList {
    constructor(element) {
      this.element = element;
    }

    remove(...tokens) {
      const classes = new Set(this.element.className.split(/\s+/).filter(Boolean));
      for (const token of tokens) classes.delete(token);
      this.element.className = [...classes].join(' ');
    }

    toggle(token, force) {
      const classes = new Set(this.element.className.split(/\s+/).filter(Boolean));
      const shouldHave = force ?? !classes.has(token);
      if (shouldHave) {
        classes.add(token);
      } else {
        classes.delete(token);
      }
      this.element.className = [...classes].join(' ');
    }
  }

  class FakeElement {
    constructor(tagName, ownerDocument) {
      this.tagName = tagName;
      this.ownerDocument = ownerDocument;
      this.className = '';
      this.dataset = {};
      this.textContent = '';
      this.value = '';
      this.name = '';
      this.checked = false;
      this.disabled = false;
      this.children = [];
      this.listeners = new Map();
      this.attributes = new Map();
      this.parentNode = null;
      this._id = '';
      this.classList = new FakeClassList(this);
    }

    set id(value) {
      this._id = value;
      if (value) {
        this.ownerDocument.elementsById.set(value, this);
      }
    }

    get id() {
      return this._id;
    }

    append(...children) {
      for (const child of children) {
        child.parentNode = this;
        this.children.push(child);
      }
    }

    replaceChildren(...children) {
      this.children = [];
      this.append(...children);
    }

    addEventListener(type, listener) {
      this.listeners.set(type, listener);
    }

    dispatchEvent(event) {
      event.target = this;
      const listener = this.listeners.get(event.type);
      if (listener) {
        listener(event);
      }
      return !event.defaultPrevented;
    }

    reset() {
      for (const field of this.children) {
        if ('checked' in field && field.type === 'checkbox') {
          field.checked = false;
        } else if ('value' in field) {
          field.value = '';
        }
      }
    }

    setAttribute(name, value) {
      this.attributes.set(name, String(value));
    }

    getAttribute(name) {
      return this.attributes.get(name) || null;
    }

    get elements() {
      return this.children.filter((child) => child.name);
    }
  }

  class FakeDocument {
    constructor() {
      this.elementsById = new Map();
      this.screenButtons = [];
      this.screens = [];
    }

    createElement(tagName) {
      return new FakeElement(tagName, this);
    }

    getElementById(id) {
      return this.elementsById.get(id) || null;
    }

    querySelectorAll(selector) {
      if (selector === '[data-screen-target]') {
        return this.screenButtons;
      }
      if (selector === '[data-screen]') {
        return this.screens;
      }
      return [];
    }
  }

  class FakeFormData {
    constructor(form) {
      this.values = new Map();
      for (const field of form.elements) {
        if (field.type === 'checkbox') {
          if (field.checked) {
            this.values.set(field.name, 'on');
          }
          continue;
        }
        this.values.set(field.name, field.value);
      }
    }

    get(name) {
      return this.values.get(name);
    }
  }

  const doc = new FakeDocument();
  const bookingForm = doc.createElement('form');
  bookingForm.id = 'booking-form';

  const bookingName = doc.createElement('input');
  bookingName.name = 'name';
  bookingName.value = 'Alex Morgan';

  const bookingEmail = doc.createElement('input');
  bookingEmail.name = 'email';
  bookingEmail.value = 'alex@example.com';

  const bookingDate = doc.createElement('input');
  bookingDate.name = 'date';
  bookingDate.value = '2026-04-13';

  const bookingTime = doc.createElement('input');
  bookingTime.name = 'time';
  bookingTime.value = '08:30';

  bookingForm.append(bookingName, bookingEmail, bookingDate, bookingTime);

  const bookingSuccess = doc.createElement('p');
  bookingSuccess.id = 'success-message';
  bookingSuccess.className = 'success-banner hidden';

  const appointmentsList = doc.createElement('ul');
  appointmentsList.id = 'appointments-list';

  const originalFormData = globalThis.FormData;
  const originalDateNow = Date.now;
  globalThis.FormData = FakeFormData;
  Date.now = () => 1234;

  const backingStore = new Map();
  const storage = {
    getItem(key) {
      return backingStore.has(key) ? backingStore.get(key) : null;
    },
    setItem(key, value) {
      backingStore.set(key, value);
    },
  };

  try {
    const app = initializeBookingApp(doc, { storage });

    assert.equal(app.getAppointments().length, 2);
    assert.equal(appointmentsList.children.length, 2);

    bookingForm.dispatchEvent({
      type: 'submit',
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
    });

    assert.equal(app.getAppointments().length, 3);
    assert.match(bookingSuccess.textContent, /Appointment booked for Alex Morgan/);
  } finally {
    globalThis.FormData = originalFormData;
    Date.now = originalDateNow;
  }
});

test('saving settings updates the booking experience and persists after refresh', () => {
  class FakeClassList {
    constructor(element) {
      this.element = element;
    }

    remove(...tokens) {
      const classes = new Set(this.element.className.split(/\s+/).filter(Boolean));
      for (const token of tokens) classes.delete(token);
      this.element.className = [...classes].join(' ');
    }

    toggle(token, force) {
      const classes = new Set(this.element.className.split(/\s+/).filter(Boolean));
      const shouldHave = force ?? !classes.has(token);
      if (shouldHave) {
        classes.add(token);
      } else {
        classes.delete(token);
      }
      this.element.className = [...classes].join(' ');
    }
  }

  class FakeElement {
    constructor(tagName, ownerDocument) {
      this.tagName = tagName;
      this.ownerDocument = ownerDocument;
      this.className = '';
      this.dataset = {};
      this.textContent = '';
      this.value = '';
      this.name = '';
      this.checked = false;
      this.disabled = false;
      this.children = [];
      this.listeners = new Map();
      this.attributes = new Map();
      this.parentNode = null;
      this._id = '';
      this.classList = new FakeClassList(this);
    }

    set id(value) {
      this._id = value;
      if (value) {
        this.ownerDocument.elementsById.set(value, this);
      }
    }

    get id() {
      return this._id;
    }

    append(...children) {
      for (const child of children) {
        child.parentNode = this;
        this.children.push(child);
      }
    }

    replaceChildren(...children) {
      this.children = [];
      this.append(...children);
    }

    addEventListener(type, listener) {
      this.listeners.set(type, listener);
    }

    dispatchEvent(event) {
      event.target = this;
      const listener = this.listeners.get(event.type);
      if (listener) {
        listener(event);
      }
      return !event.defaultPrevented;
    }

    reset() {
      for (const field of this.children) {
        if ('checked' in field && field.type === 'checkbox') {
          field.checked = false;
        } else if ('value' in field) {
          field.value = '';
        }
      }
    }

    setAttribute(name, value) {
      this.attributes.set(name, String(value));
    }

    getAttribute(name) {
      return this.attributes.get(name) || null;
    }

    get elements() {
      return this.children.filter((child) => child.name);
    }
  }

  class FakeDocument {
    constructor() {
      this.elementsById = new Map();
      this.screenButtons = [];
      this.screens = [];
    }

    createElement(tagName) {
      return new FakeElement(tagName, this);
    }

    getElementById(id) {
      return this.elementsById.get(id) || null;
    }

    querySelectorAll(selector) {
      if (selector === '[data-screen-target]') {
        return this.screenButtons;
      }
      if (selector === '[data-screen]') {
        return this.screens;
      }
      return [];
    }
  }

  class FakeFormData {
    constructor(form) {
      this.values = new Map();
      for (const field of form.elements) {
        if (field.type === 'checkbox') {
          if (field.checked) {
            this.values.set(field.name, 'on');
          }
          continue;
        }
        this.values.set(field.name, field.value);
      }
    }

    get(name) {
      return this.values.get(name);
    }
  }

  const createAppDocument = () => {
    const doc = new FakeDocument();

    const demoName = doc.createElement('p');
    demoName.id = 'demo-name';

    const introText = doc.createElement('p');
    introText.id = 'intro-text';

    const bookingLengthSummary = doc.createElement('p');
    bookingLengthSummary.id = 'booking-length-summary';

    const bookingForm = doc.createElement('form');
    bookingForm.id = 'booking-form';

    const bookingName = doc.createElement('input');
    bookingName.name = 'name';
    bookingName.value = 'Alex Morgan';

    const bookingEmail = doc.createElement('input');
    bookingEmail.name = 'email';
    bookingEmail.value = 'alex@example.com';

    const bookingDate = doc.createElement('input');
    bookingDate.name = 'date';
    bookingDate.value = '2026-04-13';

    const bookingTime = doc.createElement('input');
    bookingTime.name = 'time';
    bookingTime.value = '08:30';

    const bookingNotesField = doc.createElement('label');
    bookingNotesField.id = 'booking-notes-field';

    const bookingNotes = doc.createElement('textarea');
    bookingNotes.id = 'booking-notes-input';
    bookingNotes.name = 'notes';
    bookingNotes.value = 'Needs wheelchair access';

    bookingNotesField.append(bookingNotes);
    bookingForm.append(bookingName, bookingEmail, bookingDate, bookingTime, bookingNotes);

    const bookingSuccess = doc.createElement('p');
    bookingSuccess.id = 'success-message';
    bookingSuccess.className = 'success-banner hidden';

    const settingsForm = doc.createElement('form');
    settingsForm.id = 'settings-form';

    const settingsDemoName = doc.createElement('input');
    settingsDemoName.id = 'settings-demo-name';
    settingsDemoName.name = 'demoName';

    const settingsIntroText = doc.createElement('textarea');
    settingsIntroText.id = 'settings-intro-text';
    settingsIntroText.name = 'introText';

    const settingsLength = doc.createElement('input');
    settingsLength.id = 'settings-appointment-length';
    settingsLength.name = 'defaultAppointmentLength';
    settingsLength.type = 'number';

    const settingsNotesEnabled = doc.createElement('input');
    settingsNotesEnabled.id = 'settings-notes-enabled';
    settingsNotesEnabled.name = 'bookingNotesEnabled';
    settingsNotesEnabled.type = 'checkbox';

    settingsForm.append(settingsDemoName, settingsIntroText, settingsLength, settingsNotesEnabled);

    const settingsSuccess = doc.createElement('p');
    settingsSuccess.id = 'settings-success-message';
    settingsSuccess.className = 'success-banner hidden';

    const appointmentsList = doc.createElement('ul');
    appointmentsList.id = 'appointments-list';

    const bookingScreen = doc.createElement('section');
    bookingScreen.dataset.screen = 'booking';
    const settingsScreen = doc.createElement('section');
    settingsScreen.dataset.screen = 'settings';
    settingsScreen.className = 'hidden';
    doc.screens.push(bookingScreen, settingsScreen);

    const bookingButton = doc.createElement('button');
    bookingButton.dataset.screenTarget = 'booking';
    bookingButton.className = 'secondary-button';
    const settingsButton = doc.createElement('button');
    settingsButton.dataset.screenTarget = 'settings';
    settingsButton.className = 'secondary-button';
    doc.screenButtons.push(bookingButton, settingsButton);

    return {
      doc,
      bookingForm,
      bookingNotes,
      bookingNotesField,
      bookingSuccess,
      settingsForm,
      settingsDemoName,
      settingsIntroText,
      settingsLength,
      settingsNotesEnabled,
      settingsSuccess,
      appointmentsList,
      demoName,
      introText,
      bookingLengthSummary,
      bookingButton,
      settingsButton,
      bookingScreen,
      settingsScreen,
    };
  };

  const originalFormData = globalThis.FormData;
  const originalDateNow = Date.now;
  globalThis.FormData = FakeFormData;
  Date.now = () => 999;

  const backingStore = new Map();
  const storage = {
    getItem(key) {
      return backingStore.has(key) ? backingStore.get(key) : null;
    },
    setItem(key, value) {
      backingStore.set(key, value);
    },
  };

  try {
    const firstRender = createAppDocument();
    const app = initializeBookingApp(firstRender.doc, { storage });

    assert.equal(app.getAppointments().length, 2);
    assert.equal(firstRender.appointmentsList.children.length, 2);
    assert.equal(firstRender.demoName.textContent, defaultSettings.demoName);
    assert.equal(firstRender.bookingLengthSummary.textContent, '30-minute default appointment');

    firstRender.settingsDemoName.value = 'Neighborhood Clinic';
    firstRender.settingsIntroText.value = 'Book a quick consult with our care team.';
    firstRender.settingsLength.value = '45';
    firstRender.settingsNotesEnabled.checked = false;

    firstRender.settingsForm.dispatchEvent({
      type: 'submit',
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
    });

    assert.equal(app.getSettings().demoName, 'Neighborhood Clinic');
    assert.equal(firstRender.demoName.textContent, 'Neighborhood Clinic');
    assert.equal(firstRender.introText.textContent, 'Book a quick consult with our care team.');
    assert.equal(firstRender.bookingLengthSummary.textContent, '45-minute default appointment');
    assert.ok(firstRender.bookingNotesField.className.includes('hidden'));
    assert.equal(firstRender.bookingNotes.disabled, true);
    assert.match(firstRender.settingsSuccess.textContent, /Settings saved successfully/);
    assert.ok(!firstRender.settingsSuccess.className.includes('hidden'));

    firstRender.settingsButton.dispatchEvent({ type: 'click' });
    assert.equal(firstRender.settingsButton.getAttribute('aria-pressed'), 'true');
    assert.equal(firstRender.bookingButton.getAttribute('aria-pressed'), 'false');
    assert.ok(firstRender.bookingScreen.className.includes('hidden'));
    assert.ok(!firstRender.settingsScreen.className.includes('hidden'));

    firstRender.bookingForm.dispatchEvent({
      type: 'submit',
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
    });

    assert.equal(app.getAppointments().length, 3);
    assert.equal(app.getAppointments()[2].notes, '');
    assert.match(firstRender.bookingSuccess.textContent, /Appointment booked for Alex Morgan/);

    const secondRender = createAppDocument();
    const refreshed = initializeBookingApp(secondRender.doc, { storage });

    assert.equal(refreshed.getSettings().demoName, 'Neighborhood Clinic');
    assert.equal(secondRender.demoName.textContent, 'Neighborhood Clinic');
    assert.equal(secondRender.introText.textContent, 'Book a quick consult with our care team.');
    assert.equal(secondRender.bookingLengthSummary.textContent, '45-minute default appointment');
    assert.ok(secondRender.bookingNotesField.className.includes('hidden'));
    assert.equal(secondRender.bookingNotes.disabled, true);
    assert.equal(secondRender.appointmentsList.children.length, 3);
  } finally {
    globalThis.FormData = originalFormData;
    Date.now = originalDateNow;
  }
});
