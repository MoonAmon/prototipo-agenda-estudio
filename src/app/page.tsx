
'use client'; 

import React, { useState, useMemo, useEffect, Suspense } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AppHeader } from '@/components/layout/header';
import { CalendarView } from '@/components/calendar/calendar-view';
import { Button } from '@/components/ui/button';
import { ShareDialog } from '@/components/share/share-dialog';
import { exportCalendarAsImage, exportCalendarAsPdf } from '@/lib/export';
import { 
  getBookingsForWeek,
  getWeekDates, 
  calculateMonthlyClientMetrics, 
  calculateBookingDurationInHours,
  CALENDAR_START_HOUR, 
  CALENDAR_END_HOUR 
} from '@/lib/calendar-utils';
import type { Booking, MonthlyRecipe } from '@/types';
import type { ClientDocument, ProjectDocument, BookingDocument } from '@/types/firestore';
import { sampleClients, sampleProjects, sampleBookings as allSampleBookingDocuments } from '@/lib/sample-firestore-data';
import { Share2, Image as ImageIcon, FileText, BarChart3, ChevronDown, ChevronUp, CheckCircle, XCircle, MinusCircle, CheckSquare } from 'lucide-react';

export default function HomePage() {
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const calendarExportId = "calendar-table-export-area"; 

  const [displayedDate, setDisplayedDate] = useState(new Date());
  const [bookings, setBookings] = useState<Booking[]>([]); 
  const [expandedClients, setExpandedClients] = useState<Record<string, boolean>>({});

  const [allClientsData, setAllClientsData] = useState<ClientDocument[]>([]);
  const [allProjectsData, setAllProjectsData] = useState<ProjectDocument[]>([]);
  const [allBookingDocuments, setAllBookingDocuments] = useState<BookingDocument[]>([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  const STORAGE_KEY = 'sessionSnapData';

  // Load data from local storage on component mount
  useEffect(() => {
    try {
      const storedData = localStorage.getItem(STORAGE_KEY);
      if (storedData) {
        const { clients, projects, bookings } = JSON.parse(storedData);
        
        const parsedBookings = bookings.map((b: any) => ({
          ...b,
          startTime: new Date(b.startTime),
          endTime: new Date(b.endTime),
        }));
        const parsedProjects = projects.map((p: any) => ({
          ...p,
          createdAt: new Date(p.createdAt),
        }));

        setAllClientsData(clients);
        setAllProjectsData(parsedProjects);
        setAllBookingDocuments(parsedBookings);
      } else {
        // Initialize with sample data if nothing is in storage
        setAllClientsData(sampleClients);
        setAllProjectsData(sampleProjects);
        setAllBookingDocuments(allSampleBookingDocuments);
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ clients: sampleClients, projects: sampleProjects, bookings: allSampleBookingDocuments }));
      }
    } catch (error) {
        console.error("Failed to parse data from localStorage, falling back to sample data.", error);
        setAllClientsData(sampleClients);
        setAllProjectsData(sampleProjects);
        setAllBookingDocuments(allSampleBookingDocuments);
    }
    setIsDataLoaded(true);
  }, []);

  useEffect(() => {
    if (isDataLoaded) {
      const currentWeekDates = getWeekDates(displayedDate);
      setBookings(getBookingsForWeek(currentWeekDates, allBookingDocuments, allClientsData, allProjectsData));
    }
  }, [displayedDate, allBookingDocuments, allClientsData, allProjectsData, isDataLoaded]);

  const handleNewBookings = (newlyConfirmedUiBookings: Booking[]) => {
    // Convert UI Bookings to BookingDocuments
    const newBookingDocuments: BookingDocument[] = newlyConfirmedUiBookings.map(uiBooking => ({
      id: uiBooking.id,
      clientId: uiBooking.clientId,
      projectId: uiBooking.projectId,
      startTime: uiBooking.startTime,
      endTime: uiBooking.endTime,
      duration: calculateBookingDurationInHours(uiBooking),
    }));
    
    const updatedBookingDocs = [...allBookingDocuments, ...newBookingDocuments];
    let updatedClients = [...allClientsData];
    let updatedProjects = [...allProjectsData];

    newlyConfirmedUiBookings.forEach(uiBooking => {
      // Check if a new client was created and add them to the state if they don't exist
      if (uiBooking.clientId.startsWith('new-client-') && !updatedClients.find(c => c.id === uiBooking.clientId)) {
        updatedClients.push({id: uiBooking.clientId, name: uiBooking.clientName, phone: 'N/A'});
      }
      // Check if a new project was created and add them to the state if they don't exist
      if (uiBooking.projectId.startsWith('new-project-') && !updatedProjects.find(p => p.id === uiBooking.projectId)) {
        const projectName = uiBooking.title?.split(' / ')[1]?.split(' - ')[0] || 'New Project';
        updatedProjects.push({
          id: uiBooking.projectId, 
          clientId: uiBooking.clientId, 
          name: projectName, 
          billingType: 'personalizado', // Default for new projects from calendar
          customRate: 0, // Default
          createdAt: new Date()
        });
      }
    });

    // Update state for all three data types
    setAllBookingDocuments(updatedBookingDocs);
    setAllClientsData(updatedClients);
    setAllProjectsData(updatedProjects);
    
    // Save the complete updated state to localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      clients: updatedClients,
      projects: updatedProjects,
      bookings: updatedBookingDocs
    }));
  };
  
  const monthlyRecipe: MonthlyRecipe = useMemo(() => {
    return calculateMonthlyClientMetrics(allBookingDocuments, allProjectsData, allClientsData, displayedDate);
  }, [allBookingDocuments, allProjectsData, allClientsData, displayedDate]);

  const toggleClientExpansion = (clientName: string) => {
    setExpandedClients(prev => ({ ...prev, [clientName]: !prev[clientName] }));
  };

  if (!isDataLoaded) {
    return <div className="flex h-screen items-center justify-center p-8">Carregando dados...</div>;
  }

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="flex-grow container mx-auto py-8 px-4 md:px-0">
        <div className="mb-8 p-6 bg-card rounded-lg shadow-lg">
          <h2 className="text-2xl font-semibold mb-2 text-primary-foreground font-headline">Disponibilidade Semanal</h2>
          <p className="text-muted-foreground mb-1">
            Veja a agenda do seu estúdio para a semana (Segunda a Sábado, das {String(CALENDAR_START_HOUR).padStart(2, '0')}:00 às {String(CALENDAR_END_HOUR).padStart(2, '0')}:00).
          </p>
          <ul className="text-muted-foreground list-none pl-0 mb-6 space-y-1 text-sm">
            <li className="flex items-center"><CheckCircle className="mr-2 h-4 w-4 text-green-500" /> Horário disponível</li>
            <li className="flex items-center"><XCircle className="mr-2 h-4 w-4 text-destructive" /> Horário agendado</li>
            <li className="flex items-center"><MinusCircle className="mr-2 h-4 w-4 text-yellow-500" /> Tempo de segurança (1 hora antes/depois do agendamento)</li>
            <li className="flex items-center"><CheckSquare className="mr-2 h-4 w-4 text-blue-500" /> Horário selecionado para agendamento</li>
          </ul>
          <p className="text-muted-foreground mb-6">Selecione os horários disponíveis e preencha os detalhes abaixo para fazer uma reserva.</p>
          <div className="flex flex-wrap gap-4 mb-6">
            <Button 
              onClick={() => exportCalendarAsImage(calendarExportId)} 
              variant="outline"
              className="border-accent text-accent hover:bg-accent hover:text-accent-foreground"
              aria-label="Exportar calendário como imagem"
            >
              <ImageIcon className="mr-2 h-4 w-4" /> Exportar como Imagem
            </Button>
            <Button 
              onClick={() => exportCalendarAsPdf(calendarExportId)} 
              variant="outline"
              className="border-accent text-accent hover:bg-accent hover:text-accent-foreground"
              aria-label="Exportar calendário como PDF"
            >
              <FileText className="mr-2 h-4 w-4" /> Exportar como PDF
            </Button>
            <Button 
              onClick={() => setIsShareDialogOpen(true)} 
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
              aria-label="Compartilhar disponibilidade do calendário"
            >
              <Share2 className="mr-2 h-4 w-4" /> Compartilhar Disponibilidade
            </Button>
          </div>
        </div>
        
        <CalendarView 
          initialDate={displayedDate}
          onDateChange={setDisplayedDate}
          bookings={bookings} 
          onNewBookingsAdd={handleNewBookings}
          calendarId={calendarExportId}
          allClients={allClientsData} 
          allProjects={allProjectsData} 
        />

        <div className="mt-12 p-6 bg-card rounded-lg shadow-lg">
          <h3 className="text-xl font-semibold mb-4 text-primary-foreground flex items-center">
            <BarChart3 className="mr-2 h-6 w-6 text-primary" />
            Receita Mensal de {format(displayedDate, 'MMMM yyyy', { locale: ptBR })}
          </h3>
          {Object.keys(monthlyRecipe).length > 0 ? (
            <ul className="space-y-3">
              {Object.entries(monthlyRecipe).map(([clientName, data]) => (
                <li key={clientName} className="p-3 bg-secondary/50 rounded-md shadow">
                  <div className="flex justify-between items-center">
                    <div>
                      <strong className="text-primary-foreground">{clientName}:</strong> 
                      <span className="ml-2 text-foreground">{data.totalHours.toFixed(1)} horas</span>
                      <span className="ml-2 text-muted-foreground">(@ R${data.pricePerHour.toFixed(2)}/hora)</span>
                      <span className="ml-2 font-semibold text-accent">Total: R${data.totalAmount.toFixed(2)}</span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => toggleClientExpansion(clientName)} className="text-accent hover:text-accent/80">
                      {expandedClients[clientName] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      {expandedClients[clientName] ? 'Ver Menos' : 'Ver Mais'}
                    </Button>
                  </div>
                  {expandedClients[clientName] && (
                    <div className="mt-3 pt-3 border-t border-border/50">
                      <h4 className="text-sm font-semibold text-muted-foreground mb-2">Agendamentos:</h4>
                      <ul className="space-y-1 text-xs">
                        {bookings
                          .filter(b => b.clientName === clientName && format(new Date(b.startTime), 'yyyy-MM') === format(displayedDate, 'yyyy-MM'))
                          .sort((a,b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
                          .map(booking => {
                             const project = allProjectsData.find(p => p.id === booking.projectId);
                             const projectName = project ? project.name : "Projeto Desconhecido";
                             return (
                              <li key={booking.id} className="p-2 bg-muted/30 rounded">
                                  <span className="font-medium">{format(new Date(booking.startTime), 'd MMM, HH:mm', { locale: ptBR })}</span> - 
                                  Projeto: {projectName} - 
                                  {booking.service || 'Sessão'} 
                                  ({calculateBookingDurationInHours(booking).toFixed(1)} hrs)
                              </li>
                             );
                          })}
                      </ul>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">Nenhum agendamento encontrado para este mês para gerar uma receita.</p>
          )}
        </div>
      </main>

      <footer className="py-6 text-center text-sm text-muted-foreground border-t border-border/50">
        © {new Date().getFullYear()} SessionSnap. Todos os direitos reservados.
      </footer>

      <ShareDialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen} studioName="SessionSnap Studio" calendarLink="https://example.com/sessionsnap/book" />
    </div>
  );
}
