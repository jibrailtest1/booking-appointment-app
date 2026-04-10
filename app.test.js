import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppointmentItemElement, createAppointmentItemMarkup, createSuccessMessage, formatAppointmentDate, initializeBookingApp, sortAppointments } from './app.js';

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

test('submitting the booking form adds an appointment, updates the list, and shows success', () => {
  class FakeElement {
    constructor(tagName, ownerDocument) {
      this.tagName = tagName;
      this.ownerDocument = ownerDocument;
      this.className = '';
      this.dataset = {};
      this.textContent = '';
      this.value = '';
      this.name = '';
      this.children = [];
      this.listeners = new Map();
      this.parentNode = null;
      this._id = '';
      this.classList = {
        remove: (...tokens) => {
          const classes = new Set(this.className.split(/\s+/).filter(Boolean));
          for (const token of tokens) classes.delete(token);
          this.className = [...classes].join(' ');
        },
      };
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
        if ('value' in field) {
          field.value = '';
        }
      }
    }

    get elements() {
      return this.children.filter((child) => child.name);
    }
  }

  class FakeDocument {
    constructor() {
      this.elementsById = new Map();
    }

    createElement(tagName) {
      return new FakeElement(tagName, this);
    }

    getElementById(id) {
      return this.elementsById.get(id) || null;
    }
  }

  class FakeFormData {
    constructor(form) {
      this.values = new Map(form.elements.map((field) => [field.name, field.value]));
    }

    get(name) {
      return this.values.get(name);
    }
  }

  const originalFormData = globalThis.FormData;
  const originalDateNow = Date.now;

  globalThis.FormData = FakeFormData;
  Date.now = () => 999;

  try {
    const doc = new FakeDocument();
    const form = doc.createElement('form');
    form.id = 'booking-form';

    const nameInput = doc.createElement('input');
    nameInput.name = 'name';
    nameInput.value = 'Alex Morgan';

    const emailInput = doc.createElement('input');
    emailInput.name = 'email';
    emailInput.value = 'alex@example.com';

    const dateInput = doc.createElement('input');
    dateInput.name = 'date';
    dateInput.value = '2026-04-13';

    const timeInput = doc.createElement('input');
    timeInput.name = 'time';
    timeInput.value = '08:30';

    const notesInput = doc.createElement('textarea');
    notesInput.name = 'notes';
    notesInput.value = 'Needs wheelchair access';

    form.append(nameInput, emailInput, dateInput, timeInput, notesInput);

    const successMessage = doc.createElement('p');
    successMessage.id = 'success-message';
    successMessage.className = 'success-banner hidden';

    const appointmentsList = doc.createElement('ul');
    appointmentsList.id = 'appointments-list';

    const app = initializeBookingApp(doc);

    assert.equal(app.getAppointments().length, 2);
    assert.equal(appointmentsList.children.length, 2);

    let prevented = false;
    form.dispatchEvent({
      type: 'submit',
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
        prevented = true;
      },
    });

    assert.equal(prevented, true);
    assert.equal(app.getAppointments().length, 3);
    assert.equal(appointmentsList.children.length, 3);
    assert.equal(appointmentsList.children[0].children[0].children[0].textContent, 'Alex Morgan');
    assert.match(successMessage.textContent, /Appointment booked for Alex Morgan/);
    assert.ok(!successMessage.className.includes('hidden'));
  } finally {
    globalThis.FormData = originalFormData;
    Date.now = originalDateNow;
  }
});
