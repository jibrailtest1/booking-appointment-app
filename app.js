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

export const createSuccessMessage = (appointment) =>
  `Appointment booked for ${appointment.name} on ${formatAppointmentDate(appointment.date, appointment.time)}.`;

export function initializeBookingApp(doc = document) {
  const form = doc.getElementById('booking-form');
  const successMessage = doc.getElementById('success-message');
  const appointmentsList = doc.getElementById('appointments-list');
  let appointments = [...seedAppointments];

  const renderAppointments = () => {
    appointmentsList.innerHTML = sortAppointments(appointments)
      .map((appointment) => createAppointmentItemMarkup(appointment))
      .join('');
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
      notes: String(formData.get('notes') || ''),
    };

    appointments = [...appointments, appointment];
    renderAppointments();
    successMessage.textContent = createSuccessMessage(appointment);
    successMessage.classList.remove('hidden');
    form.reset();
  });

  renderAppointments();

  return {
    getAppointments: () => appointments,
  };
}

if (typeof document !== 'undefined') {
  initializeBookingApp();
}
