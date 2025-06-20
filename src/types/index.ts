

export interface Booking {
  id: string;
  startTime: Date;
  endTime: Date;
  clientId: string; 
  clientName: string; 
  projectId: string; 
  projectName?: string; // Opcional: para facilitar a exibição, se necessário
  service?: string;
  title?: string; 
}

export interface TimeSlot {
  time: Date; 
  isBooked: boolean;
  isBuffer: boolean;
  bookingDetails?: Booking;
}

export interface DayWithSlots {
  date: Date;
  slots: TimeSlot[]; 
}

export interface ClientMonthlyMetrics {
  totalHours: number;
  pricePerHour: number; // Esta será agora uma taxa efetiva/média se os valores do projeto variarem
  totalAmount: number;  
}

export type MonthlyRecipe = Record<string, ClientMonthlyMetrics>; // A chave é o nome do cliente para exibição

export interface ProjectCostMetrics {
  totalHours: number;
  pricePerHour: number;
  totalAmount: number;
}
