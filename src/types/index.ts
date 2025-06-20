

export interface Booking {
  id: string;
  startTime: Date;
  endTime: Date;
  clientName: string; // Made mandatory for recipe calculation
  service?: string;
  title?: string; // Generic title for the booking event
  // price field removed as it's now calculated based on tiered hourly rates
}

export interface TimeSlot {
  time: Date; // Start time of the slot
  isBooked: boolean;
  isBuffer: boolean;
  bookingDetails?: Booking;
  // isSelected will be handled by an extended type in CalendarView (DisplayTimeSlot)
}

export interface DayWithSlots {
  date: Date;
  slots: TimeSlot[]; 
}

// For the monthly recipe display
export interface ClientMonthlyMetrics {
  totalHours: number;
  pricePerHour: number; // Price per hour based on the tier
  totalAmount: number;  // Total amount for the month (totalHours * pricePerHour)
}

export type MonthlyRecipe = Record<string, ClientMonthlyMetrics>;

