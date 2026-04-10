import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppointmentItemMarkup, createSuccessMessage, formatAppointmentDate, sortAppointments } from './app.js';

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
