
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
import type { Booking, TimeSlot, MonthlyRecipe, ClientMonthlyMetrics, ProjectCostMetrics } from '@/types';
import type { ProjectDocument, BookingDocument, ClientDocument, PacoteType } from '@/types/firestore';

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
 * Centralized function to get the hourly rate for a project.
 */
export function getPricePerHourForProject(project: ProjectDocument): number {
    if (!project) return 0;

    if (project.billingType === 'personalizado') {
        return project.customRate ?? 0;
    }

    if (project.billingType === 'pacote') {
        switch (project.pacoteSelecionado) {
            case 'Avulso': return 350;
            case 'Pacote 10h': return 260;
            case 'Pacote 20h': return 230;
            case 'Pacote 40h': return 160;
            default: return 350; // Default to Avulso if package is not specified
        }
    }
    return 0; // Should not be reached
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
      
      const pricePerHour = project ? getPricePerHourForProject(project) : 0;
      const bookingPrice = doc.duration * pricePerHour;


      return {
        id: doc.id,
        startTime: new Date(doc.startTime),
        endTime: new Date(doc.endTime),
        clientId: doc.clientId,
        clientName: clientName,
        projectId: doc.projectId,
        service: service, 
        title: `${clientName} / ${projectName} - ${service.substring(0,20)}`,
        price: bookingPrice
      };
    });
}


export function calculateBookingDurationInHours(booking: Booking | BookingDocument): number {
  if (!booking.startTime || !booking.endTime) return 0;
  const durationMillis = new Date(booking.endTime).getTime() - new Date(booking.startTime).getTime();
  // Round to 1 decimal place
  return parseFloat((durationMillis / (1000 * 60 * 60)).toFixed(1));
}

// Tiered pricing for client monthly invoices (NOT directly for project cost)
function getTieredPricePerHour(totalHours: number): number {
  if (totalHours >= 40) return 160;
  if (totalHours >= 20) return 230; 
  if (totalHours >= 10) return 260; 
  return 350; 
}

export function calculateClientMonthlyInvoice(bookingDurations: number[]): ClientMonthlyMetrics {
  const totalHours = bookingDurations.reduce((sum, duration) => sum + duration, 0);
  const pricePerHour = getTieredPricePerHour(totalHours);
  const totalAmount = totalHours * pricePerHour;
  return { totalHours, pricePerHour, totalAmount };
}

export function calculateMonthlyClientMetrics(
  uiBookings: Booking[], 
  targetDateForMonth: Date,
  allClients: ClientDocument[]
): MonthlyRecipe {
  const clientBookingsData: Record<string, { durations: number[], clientName: string, totalDirectPrice: number }> = {};

  uiBookings.forEach(booking => {
    if (isSameMonth(new Date(booking.startTime), targetDateForMonth) && booking.clientId) {
      const client = allClients.find(c => c.id === booking.clientId);
      const clientNameForRecipe = client ? client.name : `Cliente ID: ${booking.clientId}`;

      if (!clientBookingsData[clientNameForRecipe]) {
        clientBookingsData[clientNameForRecipe] = {
          durations: [],
          clientName: clientNameForRecipe,
          totalDirectPrice: 0,
        };
      }
      const duration = calculateBookingDurationInHours(booking);
      clientBookingsData[clientNameForRecipe].durations.push(duration);
      // Summing up the 'price' from each UI booking, which is already calculated based on project rates
      clientBookingsData[clientNameForRecipe].totalDirectPrice += booking.price || 0; 
    }
  });

  const monthlyRecipe: MonthlyRecipe = {};
  for (const clientNameKey in clientBookingsData) {
    const data = clientBookingsData[clientNameKey];
    const totalHours = data.durations.reduce((sum, duration) => sum + duration, 0);
    
    // The pricePerHour here is an *average* if rates varied, or the consistent rate if not.
    // The totalAmount is the sum of pre-calculated booking prices.
    const effectivePricePerHour = totalHours > 0 ? data.totalDirectPrice / totalHours : 0;

    monthlyRecipe[data.clientName] = { 
        totalHours, 
        pricePerHour: effectivePricePerHour, 
        totalAmount: data.totalDirectPrice
    };
  }
  return monthlyRecipe;
}


export function calculateProjectCost(
  projectBookings: BookingDocument[], // Pass only bookings for this project
  project: ProjectDocument | undefined
): ProjectCostMetrics | null {

  if (!project) {
    console.error(`Project details not provided.`);
    return null;
  }
  
  const totalHours = projectBookings.reduce((sum, booking) => sum + booking.duration, 0);
  const pricePerHour = getPricePerHourForProject(project);
  const totalAmount = totalHours * pricePerHour;

  return {
    totalHours,
    pricePerHour,
    totalAmount,
  };
}
