
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { format, addHours } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, BookMarked } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CalendarSlot } from './calendar-slot';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getWeekDates,
  generateTimeSlots,
  checkSlotAvailability,
} from '@/lib/calendar-utils';
import type { Booking, TimeSlot as TimeSlotType } from '@/types';
import type { ClientDocument, ProjectDocument } from '@/types/firestore';
import { useToast } from '@/hooks/use-toast';

interface DisplayTimeSlot extends TimeSlotType {
  isSelected: boolean;
}

interface CalendarViewProps {
  initialDate: Date;
  onDateChange: (date: Date) => void;
  bookings: Booking[];
  onNewBookingsAdd: (newBookings: Booking[]) => void;
  calendarId: string;
  allClients: ClientDocument[];
  allProjects: ProjectDocument[];
}

export function CalendarView({ 
  initialDate, 
  onDateChange, 
  bookings, 
  onNewBookingsAdd,
  calendarId,
  allClients,
  allProjects,
}: CalendarViewProps) {
  const [currentDateInternal, setCurrentDateInternal] = useState(initialDate);
  const [weekDates, setWeekDates] = useState<Date[]>([]);
  const [selectedSlots, setSelectedSlots] = useState<Date[]>([]);
  const { toast } = useToast();

  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [newClientNameInput, setNewClientNameInput] = useState<string>('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [newProjectNameInput, setNewProjectNameInput] = useState<string>('');
  const [serviceDetails, setServiceDetails] = useState<string>('Sessão');

  useEffect(() => {
    setCurrentDateInternal(initialDate);
  }, [initialDate]);

  useEffect(() => {
    const newWeekDates = getWeekDates(currentDateInternal);
    setWeekDates(newWeekDates);
  }, [currentDateInternal]);
  
  const existingClientOptions = useMemo(() => {
    return allClients.filter(c => c.id !== 'client_internal_000').map(client => ({ value: client.id, label: client.name }));
  }, [allClients]);

  const availableProjectOptions = useMemo(() => {
    if (!selectedClientId || selectedClientId === 'NEW_CLIENT') return [];
    return allProjects
      .filter(p => p.clientId === selectedClientId && p.id !== 'project_general_calendar')
      .map(project => ({ value: project.id, label: project.name }));
  }, [allProjects, selectedClientId]);

  useEffect(() => {
    // Reset project selection when client changes
    setSelectedProjectId('');
    setNewProjectNameInput('');
  }, [selectedClientId]);


  const calendarData = useMemo((): { date: Date; slots: DisplayTimeSlot[] }[] => {
    return weekDates.map(date => {
      const daySlots: DisplayTimeSlot[] = generateTimeSlots(date).map(slotTime => {
        const availability = checkSlotAvailability(slotTime, bookings);
        const isSelected = selectedSlots.some(s => s.getTime() === slotTime.getTime());
        return {
          time: slotTime,
          isBooked: availability.isBooked,
          isBuffer: availability.isBuffer,
          bookingDetails: availability.bookingDetails,
          isSelected,
        };
      });
      return { date, slots: daySlots };
    });
  }, [weekDates, bookings, selectedSlots]);

  const timeLabels = useMemo(() => {
    if (calendarData.length === 0 || calendarData[0].slots.length === 0) return [];
    return calendarData[0].slots.map(slot => format(slot.time, 'HH:mm'));
  }, [calendarData]);

  const updateDate = (newDate: Date) => {
    setCurrentDateInternal(newDate);
    onDateChange(newDate); 
    setSelectedSlots([]); 
    setSelectedClientId('');
    setNewClientNameInput('');
    setSelectedProjectId('');
    setNewProjectNameInput('');
    setServiceDetails('Sessão');
  };

  const handlePrevWeek = () => {
    const newDate = new Date(currentDateInternal);
    newDate.setDate(newDate.getDate() - 7);
    updateDate(newDate);
  };

  const handleNextWeek = () => {
    const newDate = new Date(currentDateInternal);
    newDate.setDate(newDate.getDate() + 7);
    updateDate(newDate);
  };

  const handleToday = () => {
    updateDate(new Date());
  };

  const handleSlotClick = (slotTime: Date) => {
    const { isBooked, isBuffer } = checkSlotAvailability(slotTime, bookings);
    
    if (isBooked || isBuffer) {
        setSelectedSlots(prevSelected => prevSelected.filter(s => s.getTime() !== slotTime.getTime()));
        toast({
          title: 'Horário Indisponível',
          description: 'Este horário já está agendado ou é um tempo de segurança.',
          variant: 'destructive',
        });
        return;
    }

    setSelectedSlots(prevSelected => {
      const index = prevSelected.findIndex(s => s.getTime() === slotTime.getTime());
      if (index > -1) {
        return prevSelected.filter(s => s.getTime() !== slotTime.getTime()); 
      } else {
        const newSelection = [...prevSelected, slotTime];
        newSelection.sort((a, b) => a.getTime() - b.getTime());
        return newSelection;
      }
    });
  };

  const handleConfirmBooking = () => {
    if (selectedSlots.length === 0) {
      toast({
        title: 'Nenhum Horário Selecionado',
        description: 'Por favor, selecione um ou mais horários disponíveis para agendar.',
        variant: 'destructive',
      });
      return;
    }
    
    let finalClientId = '';
    let finalClientNameToDisplay = '';

    if (selectedClientId === 'NEW_CLIENT') {
      finalClientNameToDisplay = newClientNameInput.trim();
      if (!finalClientNameToDisplay) {
        toast({ title: "Nome do Cliente Faltando", description: "Por favor, digite um nome para o novo cliente.", variant: "destructive" });
        return;
      }
      finalClientId = `new-client-${Date.now()}`; 
    } else {
      const client = allClients.find(c => c.id === selectedClientId);
      if (!client) {
         toast({ title: "Cliente Não Selecionado", description: "Por favor, selecione um cliente existente.", variant: "destructive" });
        return;
      }
      finalClientId = client.id;
      finalClientNameToDisplay = client.name;
    }

    let finalProjectId = '';
    let finalProjectNameToDisplay = '';

    if (selectedProjectId === 'NEW_PROJECT') {
      finalProjectNameToDisplay = newProjectNameInput.trim();
      if (!finalProjectNameToDisplay) {
        toast({ title: "Nome do Projeto Faltando", description: "Por favor, digite um nome para o novo projeto.", variant: "destructive" });
        return;
      }
      if (!finalClientId || (selectedClientId === 'NEW_CLIENT' && !newClientNameInput.trim())){
         toast({ title: "Cliente Necessário para Novo Projeto", description: "Um cliente deve ser selecionado ou criado antes de adicionar um novo projeto.", variant: "destructive" });
        return;
      }
      finalProjectId = `new-project-${Date.now()}`;
    } else {
      const project = allProjects.find(p => p.id === selectedProjectId);
      if (!project) {
        toast({ title: "Projeto Não Selecionado", description: "Por favor, selecione ou crie um projeto para este agendamento.", variant: "destructive" });
        return;
      }
      finalProjectId = project.id;
      finalProjectNameToDisplay = project.name;
    }


    const finalServiceDetails = serviceDetails.trim() || "Sessão";
        
    const newlyConfirmedBookings: Booking[] = selectedSlots.map(slotTimeToBook => ({
      id: `booking-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      startTime: slotTimeToBook,
      endTime: addHours(slotTimeToBook, 1), 
      clientId: finalClientId,
      clientName: finalClientNameToDisplay, 
      projectId: finalProjectId,
      service: finalServiceDetails,
      title: `${finalClientNameToDisplay} / ${finalProjectNameToDisplay} - ${finalServiceDetails}`,
    }));

    onNewBookingsAdd(newlyConfirmedBookings); 
    
    setSelectedSlots([]); 
    setSelectedClientId('');
    setNewClientNameInput('');
    setSelectedProjectId('');
    setNewProjectNameInput('');
    setServiceDetails('Sessão');

    toast({
      title: 'Agendamento Confirmado!',
      description: `${newlyConfirmedBookings.length} horário(s) agendado(s) para ${finalClientNameToDisplay} no projeto ${finalProjectNameToDisplay}.`,
    });
  };

  if (calendarData.length === 0) {
    return <div className="p-4 text-center text-muted-foreground">Carregando calendário...</div>;
  }

  return (
    <div id={calendarId} className="p-4 md:p-6 bg-card rounded-lg shadow-xl">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrevWeek} aria-label="Semana anterior">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button variant="outline" onClick={handleNextWeek} aria-label="Próxima semana">
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
        <div className="text-center">
          <h2 className="text-xl md:text-2xl font-semibold text-primary-foreground">
            {weekDates.length > 0 ?
             `${format(weekDates[0], 'd MMM', { locale: ptBR })} - ${format(weekDates[weekDates.length - 1], 'd MMM, yyyy', { locale: ptBR })}` :
             'Carregando...'}
          </h2>
          <Button variant="link" onClick={handleToday} className="text-sm text-accent p-0 h-auto">Ir para Hoje</Button>
        </div>
        <div className="min-w-[180px]"></div> {/* Spacer */}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse border border-border/50">
          <thead className="bg-secondary/50">
            <tr>
              <th scope="col" className="sticky left-0 z-10 bg-secondary/50 p-3 text-xs md:text-sm font-medium text-secondary-foreground border-b border-r border-border/50 w-24">
                Hora
              </th>
              {weekDates.map(date => (
                <th scope="col" key={date.toISOString()} className="p-3 text-xs md:text-sm font-medium text-secondary-foreground border-b border-r border-border/50 min-w-[100px] md:min-w-[120px]">
                  <div>{format(date, 'EEE', { locale: ptBR })}</div>
                  <div className="text-xs text-muted-foreground">{format(date, 'dd/MM')}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {timeLabels.map((timeLabel, rowIndex) => (
              <tr key={timeLabel}>
                <td className="sticky left-0 z-10 bg-card p-3 text-xs md:text-sm font-medium text-muted-foreground border-b border-r border-border/50 align-top h-16 w-24">
                  {timeLabel}
                </td>
                {calendarData.map(day => (
                  <td key={`${day.date.toISOString()}-${timeLabel}`} className="p-0 align-top h-16">
                    <CalendarSlot
                      slot={day.slots[rowIndex]}
                      onSlotClick={handleSlotClick}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedSlots.length > 0 && (
        <div className="mt-8 p-6 bg-secondary/30 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold mb-4 text-primary-foreground">Detalhes do Agendamento para {selectedSlots.length} Horário(s)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="client-select" className="text-foreground">Cliente</Label>
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger id="client-select" className="bg-input text-foreground">
                  <SelectValue placeholder="Selecione ou Adicione um Cliente" />
                </SelectTrigger>
                <SelectContent className="bg-popover text-popover-foreground">
                  {existingClientOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                  <SelectItem value="NEW_CLIENT">Adicionar Novo Cliente...</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {selectedClientId === 'NEW_CLIENT' && (
              <div>
                <Label htmlFor="new-client-name" className="text-foreground">Nome do Novo Cliente</Label>
                <Input 
                  id="new-client-name" 
                  value={newClientNameInput} 
                  onChange={(e) => setNewClientNameInput(e.target.value)} 
                  placeholder="Digite o nome do novo cliente"
                  className="bg-input text-foreground" 
                />
              </div>
            )}
            
            <div>
              <Label htmlFor="project-select" className="text-foreground">Projeto</Label>
              <Select 
                value={selectedProjectId} 
                onValueChange={setSelectedProjectId}
                disabled={!selectedClientId || (selectedClientId === 'NEW_CLIENT' && !newClientNameInput.trim())}
              >
                <SelectTrigger id="project-select" className="bg-input text-foreground">
                  <SelectValue placeholder="Selecione ou Adicione um Projeto" />
                </SelectTrigger>
                <SelectContent className="bg-popover text-popover-foreground">
                  {availableProjectOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                  {selectedClientId && selectedClientId !== 'NEW_CLIENT' && (
                     <SelectItem value="NEW_PROJECT">Adicionar Novo Projeto para {allClients.find(c=>c.id === selectedClientId)?.name || 'Cliente Selecionado'}...</SelectItem>
                  )}
                   {selectedClientId === 'NEW_CLIENT' && newClientNameInput.trim() && (
                     <SelectItem value="NEW_PROJECT">Adicionar Novo Projeto para {newClientNameInput.trim()}...</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {selectedProjectId === 'NEW_PROJECT' && (
              <div>
                <Label htmlFor="new-project-name" className="text-foreground">Nome do Novo Projeto</Label>
                <Input 
                  id="new-project-name" 
                  value={newProjectNameInput} 
                  onChange={(e) => setNewProjectNameInput(e.target.value)} 
                  placeholder="Digite o nome do novo projeto"
                  className="bg-input text-foreground" 
                />
              </div>
            )}

            <div>
              <Label htmlFor="service-details" className="text-foreground">Detalhes do Serviço</Label>
              <Input 
                id="service-details" 
                value={serviceDetails} 
                onChange={(e) => setServiceDetails(e.target.value)} 
                placeholder="ex: Gravação de Voz, Mixagem"
                className="bg-input text-foreground" 
              />
            </div>
            
          </div>
          <Button 
            onClick={handleConfirmBooking} 
            className="mt-6 w-full md:w-auto bg-primary hover:bg-primary/90 text-primary-foreground"
            aria-label="Confirmar agendamento para os horários selecionados"
          >
            <BookMarked className="mr-2 h-4 w-4" />
            Confirmar Agendamento ({selectedSlots.length})
          </Button>
        </div>
      )}
    </div>
  );
}
