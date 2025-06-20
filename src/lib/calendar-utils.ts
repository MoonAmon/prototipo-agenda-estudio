
import {
  addDays,
  startOfWeek,
  setHours,
  setMinutes,
  setSeconds,
  isWithinInterval,
  addHours,
  subHours,
  eachHourOfInterval,
  isSameHour,
  format,
  isSaturday,
  isSunday,
  nextMonday,
  isMonday,
  startOfMonth,
  endOfMonth,
  isSameMonth,
  isSameDay,
  startOfDay,
  endOfDay
} from 'date-fns';
import type { Booking, TimeSlot, MonthlyRecipe, ProjectCostMetrics } from '@/types';
import type { ProjectDocument, BookingDocument, ClientDocument } from '@/types/firestore';

const BUFFER_HOURS = 1;
export const CALENDAR_START_HOUR = 9;
export const CALENDAR_END_HOUR = 19; // Display up to 18:00-19:00 slot

export function getWeekDates(currentDate: Date = new Date()): Date[] {
  let monday = startOfWeek(currentDate, { weekStartsOn: 1 }); // 1 for Monday
  const weekDates: Date[] = [];
  for (let i = 0; i < 6; i++) { // Monday to Saturday
    weekDates.push(addDays(monday, i));
  }
  return weekDates;
}

export function generateTimeSlots(date: Date): Date[] {
  const startCalDay = setHours(setMinutes(setSeconds(date, 0), 0), CALENDAR_START_HOUR);
  const endCalDay = setHours(setMinutes(setSeconds(date, 0), 0), CALENDAR_END_HOUR -1); 
  
  return eachHourOfInterval({
    start: startCalDay,
    end: endCalDay,
  });
}

export function checkSlotAvailability(
  slotTime: Date, 
  bookings: Booking[] // These are UI-facing Booking objects
): { isBooked: boolean; isBuffer: boolean; bookingDetails?: Booking } {
  const slotEndTime = addHours(slotTime, 1);

  for (const booking of bookings) {
    const bookingStartTime = new Date(booking.startTime); 
    const bookingEndTime = new Date(booking.endTime);   

    if (
      (slotTime >= bookingStartTime && slotTime < bookingEndTime) ||
      (slotEndTime > bookingStartTime && slotEndTime <= bookingEndTime) ||
      (bookingStartTime >= slotTime && bookingEndTime <= slotEndTime)
    ) {
      return { isBooked: true, isBuffer: false, bookingDetails: booking };
    }
  }

  for (const booking of bookings) {
    const bookingStartTime = new Date(booking.startTime);
    const bookingEndTime = new Date(booking.endTime);

    let isDirectlyBooked = false;
    if (
      (slotTime >= bookingStartTime && slotTime < bookingEndTime) ||
      (slotEndTime > bookingStartTime && slotEndTime <= bookingEndTime) ||
      (bookingStartTime >= slotTime && bookingEndTime <= slotEndTime)
    ) {
      isDirectlyBooked = true;
    }
    if (isDirectlyBooked) continue; 

    const bufferBeforeStart = subHours(bookingStartTime, BUFFER_HOURS);
    const bufferAfterEnd = addHours(bookingEndTime, BUFFER_HOURS);

    if (slotTime >= bufferBeforeStart && slotTime < bookingStartTime) {
      return { isBooked: false, isBuffer: true, bookingDetails: booking };
    }
    if (slotTime >= bookingEndTime && slotTime < bufferAfterEnd) {
      return { isBooked: false, isBuffer: true, bookingDetails: booking };
    }
  }

  return { isBooked: false, isBuffer: false };
}

/**
 * Determines the price per hour for a project based on its billing model and total hours.
 * Custom rates override tiered pricing.
 * @param project The project document.
 * @param totalHours The total hours booked for this project.
 * @returns The price per hour.
 */
function getProjectPricePerHour(project: ProjectDocument, totalHours: number): number {
    // A specific custom rate on a 'personalizado' project always wins.
    if (project.billingType === 'personalizado' && typeof project.customRate === 'number') {
        return project.customRate;
    }

    // For 'pacote' billing, apply tiered pricing based on total hours.
    // This also serves as the default for any other cases.
    if (totalHours >= 40) return 160;
    if (totalHours >= 20) return 230;
    if (totalHours >= 10) return 260;
    
    // Default rate for < 10 hours is R$350.
    return 350;
}

/**
 * Calculates the total cost metrics for a given project based on all its bookings.
 * @param projectBookings ALL bookings for this project.
 * @param project The project document.
 * @returns The cost metrics, or null if project is not provided.
 */
export function calculateProjectCost(
  projectBookings: BookingDocument[], // Pass only bookings for this project
  project: ProjectDocument | undefined
): ProjectCostMetrics | null {

  if (!project) {
    console.error(`Project details not provided.`);
    return null;
  }
  
  const totalHours = projectBookings.reduce((sum, booking) => sum + booking.duration, 0);
  const pricePerHour = getProjectPricePerHour(project, totalHours);
  const totalAmount = totalHours * pricePerHour;

  return {
    totalHours,
    pricePerHour,
    totalAmount,
  };
}


export function getBookingsForWeek(
  weekDates: Date[],
  allBookingDocuments: BookingDocument[],
  allClients: ClientDocument[],
  allProjects: ProjectDocument[]
): Booking[] {
  if (weekDates.length === 0) return [];

  const firstDayOfWeek = startOfDay(weekDates[0]);
  const lastDayOfWeek = endOfDay(weekDates[weekDates.length - 1]);

  return allBookingDocuments
    .filter(doc => {
      const bookingStartTime = new Date(doc.startTime);
      return bookingStartTime >= firstDayOfWeek && bookingStartTime <= lastDayOfWeek;
    })
    .map(doc => {
      const client = allClients.find(c => c.id === doc.clientId);
      const project = allProjects.find(p => p.id === doc.projectId);
      const clientName = client ? client.name : 'Cliente Desconhecido';
      const projectName = project ? project.name : "Projeto Desconhecido";
      const service = `Sessão para ${projectName}`; 
      
      return {
        id: doc.id,
        startTime: new Date(doc.startTime),
        endTime: new Date(doc.endTime),
        clientId: doc.clientId,
        clientName: clientName,
        projectId: doc.projectId,
        service: service, 
        title: `${clientName} / ${projectName} - ${service.substring(0,20)}`,
      };
    });
}


export function calculateBookingDurationInHours(booking: Booking | BookingDocument): number {
  if (!booking.startTime || !booking.endTime) return 0;
  const durationMillis = new Date(booking.endTime).getTime() - new Date(booking.startTime).getTime();
  // Round to 1 decimal place
  return parseFloat((durationMillis / (1000 * 60 * 60)).toFixed(1));
}


export function calculateMonthlyClientMetrics(
  allBookingDocuments: BookingDocument[],
  allProjects: ProjectDocument[],
  allClients: ClientDocument[],
  targetDateForMonth: Date
): MonthlyRecipe {
  const monthlyRecipe: MonthlyRecipe = {};

  const monthlyBookings = allBookingDocuments.filter(b =>
    isSameMonth(new Date(b.startTime), targetDateForMonth)
  );

  const clientBookings: Record<string, BookingDocument[]> = {};
  monthlyBookings.forEach(booking => {
    if (!clientBookings[booking.clientId]) {
      clientBookings[booking.clientId] = [];
    }
    clientBookings[booking.clientId].push(booking);
  });

  for (const clientId in clientBookings) {
    const client = allClients.find(c => c.id === clientId);
    if (!client) continue;

    let clientTotalHours = 0;
    let clientTotalAmount = 0;

    const projectGroups: Record<string, BookingDocument[]> = {};
    clientBookings[clientId].forEach(booking => {
      if (!projectGroups[booking.projectId]) {
        projectGroups[booking.projectId] = [];
      }
      projectGroups[booking.projectId].push(booking);
    });

    for (const projectId in projectGroups) {
      const project = allProjects.find(p => p.id === projectId);
      if (!project) continue;

      const allBookingsForThisProject = allBookingDocuments.filter(
        b => b.projectId === projectId
      );
      
      const projectCostMetrics = calculateProjectCost(allBookingsForThisProject, project);
      
      if (projectCostMetrics) {
        const monthlyBookingsForThisProject = projectGroups[projectId];
        const monthlyHoursForThisProject = monthlyBookingsForThisProject.reduce(
          (sum, b) => sum + b.duration,
          0
        );

        clientTotalHours += monthlyHoursForThisProject;
        clientTotalAmount += monthlyHoursForThisProject * projectCostMetrics.pricePerHour;
      }
    }
    
    const effectivePricePerHour = clientTotalHours > 0 ? clientTotalAmount / clientTotalHours : 0;
    
    monthlyRecipe[client.name] = {
      totalHours: clientTotalHours,
      pricePerHour: effectivePricePerHour,
      totalAmount: clientTotalAmount,
    };
  }

  return monthlyRecipe;
}
