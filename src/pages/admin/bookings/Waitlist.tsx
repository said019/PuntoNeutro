import BookingsList from "./BookingsList";

const Waitlist = () => (
  <BookingsList title="Lista de Espera" initialStatus="waitlist" statusLocked />
);

export default Waitlist;
