
'use client';

import { CheckCircle, XCircle, MinusCircle, CheckSquare } from 'lucide-react';
import type { TimeSlot as TimeSlotType } from '@/types';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface CalendarSlotProps {
  slot: TimeSlotType & { isSelected: boolean }; // isSelected is now mandatory
  onSlotClick?: (slotTime: Date) => void;
}

export function CalendarSlot({ slot, onSlotClick }: CalendarSlotProps) {
  const { time, isBooked, isBuffer, bookingDetails, isSelected } = slot;
  const isAvailable = !isBooked && !isBuffer;

  let IconComponent;
  let iconColorClass = '';
  let slotBgClass = 'bg-card hover:bg-card/80';
  let tooltipMessage = '';

  if (isSelected) {
    IconComponent = CheckSquare;
    iconColorClass = 'text-blue-500'; // Using a distinct color for selected
    slotBgClass = 'bg-blue-500/20 hover:bg-blue-500/30';
    tooltipMessage = 'Selecionado - Clique para desmarcar ou confirme o agendamento no botão principal.';
  } else if (isBooked) {
    IconComponent = XCircle;
    iconColorClass = 'text-destructive';
    slotBgClass = 'bg-destructive/20 hover:bg-destructive/30 cursor-not-allowed';
    tooltipMessage = `Agendado: ${bookingDetails?.title || bookingDetails?.service || 'Evento'}`;
    if (bookingDetails?.clientName) {
      tooltipMessage += ` por ${bookingDetails.clientName}`;
    }
  } else if (isBuffer) {
    IconComponent = MinusCircle;
    iconColorClass = 'text-yellow-500';
    slotBgClass = 'bg-yellow-500/10 hover:bg-yellow-500/20 cursor-not-allowed';
    tooltipMessage = `Tempo de segurança (relacionado a: ${bookingDetails?.title || bookingDetails?.service || 'Evento'})`;
  } else { // Available and not selected
    IconComponent = CheckCircle;
    iconColorClass = 'text-green-500';
    slotBgClass = 'bg-green-500/10 hover:bg-green-500/20'; // More distinct available color
    tooltipMessage = 'Disponível - Clique para selecionar';
  }

  const handleClick = () => {
    if (onSlotClick) {
      // Allow click if it's available (to select) or if it's already selected (to deselect)
      // The parent component (CalendarView) will handle logic for not selecting booked/buffer slots.
      if (isAvailable || isSelected) {
         onSlotClick(slot.time);
      }
    }
  };
  
  // Determine cursor based on actual interactability
  const canBeClicked = onSlotClick && (isAvailable || (isSelected && !isBooked && !isBuffer));


  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'h-16 w-full flex items-center justify-center p-2 border-r border-b border-border/50 transition-colors',
              slotBgClass,
              canBeClicked ? 'cursor-pointer' : 'cursor-not-allowed'
            )}
            aria-label={`${slot.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${tooltipMessage}`}
            role="button"
            tabIndex={canBeClicked ? 0 : -1}
            onClick={canBeClicked ? handleClick : undefined}
            onKeyDown={canBeClicked ? (e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(); } : undefined}
          >
            <IconComponent className={cn('h-6 w-6', iconColorClass)} />
          </div>
        </TooltipTrigger>
        <TooltipContent className="bg-popover text-popover-foreground p-2 rounded-md shadow-lg max-w-xs">
          <p className="text-sm font-semibold">{slot.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(slot.time.getTime() + 60 * 60 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
          <p className="text-sm">{tooltipMessage}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
