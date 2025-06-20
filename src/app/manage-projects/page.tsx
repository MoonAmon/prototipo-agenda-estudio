
'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Link from 'next/link';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { sampleClients, sampleProjects, sampleBookings } from '@/lib/sample-firestore-data';
import { calculateProjectCost } from '@/lib/calendar-utils';
import type { ClientDocument, ProjectDocument, BookingDocument, BillingType, PacoteType } from '@/types/firestore';
import { Pencil, PlusCircle, Trash2, ArrowLeft, FileText, Copy, BarChartHorizontal } from 'lucide-react';

// Zod Schemas for form validation
const clientSchema = z.object({
  name: z.string().min(2, { message: "O nome do cliente é obrigatório." }),
  phone: z.string().min(10, { message: "O telefone deve ter pelo menos 10 dígitos." }),
});

const projectSchema = z.object({
  name: z.string().min(2, { message: "O nome do projeto é obrigatório." }),
  billingType: z.enum(['pacote', 'personalizado'], { required_error: "Selecione um tipo de cobrança." }),
  pacoteSelecionado: z.enum(["Avulso", "Pacote 10h", "Pacote 20h", "Pacote 40h"]).optional(),
  customRate: z.coerce.number().min(0, "O valor deve ser positivo.").optional(),
  targetHours: z.coerce.number().min(1, "A meta de horas deve ser de pelo menos 1.").optional(),
}).refine(data => {
  if (data.billingType === 'pacote' && !data.pacoteSelecionado) {
    return false;
  }
  return true;
}, {
  message: "Por favor, selecione um pacote.",
  path: ["pacoteSelecionado"],
}).refine(data => {
  if (data.billingType === 'personalizado' && (data.customRate === undefined || data.customRate === null)) {
    return false;
  }
  return true;
}, {
  message: "Por favor, insira um valor por hora.",
  path: ["customRate"],
});


export default function ManageProjectsClientsPage() {
  const { toast } = useToast();
  
  // State management
  const [clients, setClients] = useState<ClientDocument[]>([]);
  const [projects, setProjects] = useState<ProjectDocument[]>([]);
  const [bookings, setBookings] = useState<BookingDocument[]>([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  
  // Modal & Dialog State
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isDeleteClientDialogOpen, setIsDeleteClientDialogOpen] = useState(false);
  const [isDeleteProjectDialogOpen, setIsDeleteProjectDialogOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  // State for tracking what is being edited/deleted/viewed
  const [editingClient, setEditingClient] = useState<ClientDocument | null>(null);
  const [editingProject, setEditingProject] = useState<ProjectDocument | null>(null);
  const [deletingClientId, setDeletingClientId] = useState<string | null>(null);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [addingProjectForClientId, setAddingProjectForClientId] = useState<string | null>(null);
  
  // State for receipt modal
  const [receiptText, setReceiptText] = useState('');
  const [receiptDetails, setReceiptDetails] = useState<{ clientName: string, projectName: string } | null>(null);

  const STORAGE_KEY = 'sessionSnapData';

  // Load data from local storage on component mount
  useEffect(() => {
    try {
      const storedData = localStorage.getItem(STORAGE_KEY);
      if (storedData) {
        const { clients: storedClients, projects: storedProjects, bookings: storedBookings } = JSON.parse(storedData);
        
        const parsedBookings = storedBookings.map((b: any) => ({
          ...b,
          startTime: new Date(b.startTime),
          endTime: new Date(b.endTime),
        }));
        const parsedProjects = storedProjects.map((p: any) => ({
          ...p,
          createdAt: new Date(p.createdAt),
        }));

        setClients(storedClients);
        setProjects(parsedProjects);
        setBookings(parsedBookings);
      } else {
        // Initialize with sample data if nothing is in storage
        setClients(sampleClients);
        setProjects(sampleProjects);
        setBookings(sampleBookings);
      }
    } catch (error) {
        console.error("Failed to parse data from localStorage, falling back to sample data.", error);
        setClients(sampleClients);
        setProjects(sampleProjects);
        setBookings(sampleBookings);
    }
    setIsDataLoaded(true);
  }, []);

  // Update localStorage whenever state changes
  useEffect(() => {
    if (isDataLoaded) {
      const dataToStore = {
        clients,
        projects,
        bookings,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToStore));
    }
  }, [clients, projects, bookings, isDataLoaded]);

  // React Hook Form instances
  const clientForm = useForm<z.infer<typeof clientSchema>>({
    resolver: zodResolver(clientSchema),
    defaultValues: { name: "", phone: "" },
  });

  const projectForm = useForm<z.infer<typeof projectSchema>>({
    resolver: zodResolver(projectSchema),
    defaultValues: { billingType: 'personalizado' },
  });
  const watchedBillingType = projectForm.watch('billingType');


  // Modal Open/Close Handlers
  const handleOpenClientModal = (client: ClientDocument | null = null) => {
    setEditingClient(client);
    clientForm.reset(client || { name: "", phone: "" });
    setIsClientModalOpen(true);
  };

  const handleOpenProjectModal = (project: ProjectDocument | null, clientId: string) => {
    setEditingProject(project);
    setAddingProjectForClientId(clientId);
    projectForm.reset(project || { name: "", billingType: 'personalizado' });
    setIsProjectModalOpen(true);
  };
  
  const handleOpenDeleteClientDialog = (clientId: string) => {
    setDeletingClientId(clientId);
    setIsDeleteClientDialogOpen(true);
  };

  const handleOpenDeleteProjectDialog = (projectId: string) => {
    setDeletingProjectId(projectId);
    setIsDeleteProjectDialogOpen(true);
  };

  // CRUD Operations
  const onClientSubmit = (data: z.infer<typeof clientSchema>) => {
    if (editingClient) { 
      setClients(clients.map(c => c.id === editingClient.id ? { ...c, ...data } : c));
      toast({ title: "Cliente Atualizado!", description: `O cliente "${data.name}" foi atualizado.` });
    } else { 
      const newClient = { id: `client_${Date.now()}`, ...data };
      setClients([...clients, newClient]);
      toast({ title: "Cliente Adicionado!", description: `O cliente "${data.name}" foi criado.` });
    }
    setIsClientModalOpen(false);
  };

  const onProjectSubmit = (data: z.infer<typeof projectSchema>) => {
    if (editingProject) { 
      const updatedProject = { ...editingProject, ...data };
      setProjects(projects.map(p => p.id === editingProject.id ? updatedProject : p));
      toast({ title: "Projeto Atualizado!", description: `O projeto "${data.name}" foi atualizado.` });
    } else if (addingProjectForClientId) {
      const newProjectData: ProjectDocument = { 
        id: `project_${Date.now()}`, 
        clientId: addingProjectForClientId,
        createdAt: new Date(),
        name: data.name,
        billingType: data.billingType,
      };
      if (data.billingType === 'pacote') newProjectData.pacoteSelecionado = data.pacoteSelecionado;
      if (data.billingType === 'personalizado') newProjectData.customRate = data.customRate;
      if (data.targetHours) newProjectData.targetHours = data.targetHours;

      setProjects([...projects, newProjectData]);
      toast({ title: "Projeto Adicionado!", description: `O projeto "${data.name}" foi criado.` });
    }
    setIsProjectModalOpen(false);
  };

  const confirmDeleteClient = () => {
    if (!deletingClientId) return;
    const clientName = clients.find(c => c.id === deletingClientId)?.name;
    setBookings(bookings.filter(b => b.clientId !== deletingClientId));
    setProjects(projects.filter(p => p.clientId !== deletingClientId));
    setClients(clients.filter(c => c.id !== deletingClientId));
    
    toast({ title: "Cliente Excluído!", description: `O cliente "${clientName}" e todos os seus dados foram removidos.`, variant: 'destructive' });
    setIsDeleteClientDialogOpen(false);
    setDeletingClientId(null);
  };

  const confirmDeleteProject = () => {
    if (!deletingProjectId) return;
    const projectName = projects.find(p => p.id === deletingProjectId)?.name;
    setBookings(bookings.filter(b => b.projectId !== deletingProjectId));
    setProjects(projects.filter(p => p.id !== deletingProjectId));

    toast({ title: "Projeto Excluído!", description: `O projeto "${projectName}" e seus agendamentos foram removidos.`, variant: 'destructive' });
    setIsDeleteProjectDialogOpen(false);
    setDeletingProjectId(null);
  };
  
  // Receipt Generation Logic
  const handleGenerateReceipt = (project: ProjectDocument, client: ClientDocument) => {
    const projectBookings = bookings.filter(b => b.projectId === project.id);

    const mergeSessions = (sessions: BookingDocument[]) => {
        if (sessions.length === 0) return [];
        // Sort sessions by start time to ensure correct merging
        const sorted = [...sessions].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
        const merged: { start: Date; end: Date }[] = [];
        
        if (sorted.length === 0) return merged;
        
        let currentSession = { start: new Date(sorted[0].startTime), end: new Date(sorted[0].endTime) };

        for (let i = 1; i < sorted.length; i++) {
            const nextSessionStart = new Date(sorted[i].startTime);
            const nextSessionEnd = new Date(sorted[i].endTime);

            // If the next session starts exactly when the current one ends, merge them
            if (currentSession.end.getTime() === nextSessionStart.getTime()) {
                currentSession.end = nextSessionEnd; // Extend the end time
            } else {
                // Otherwise, push the completed session and start a new one
                merged.push(currentSession);
                currentSession = { start: nextSessionStart, end: nextSessionEnd };
            }
        }
        merged.push(currentSession); // Add the last session
        return merged;
    };

    const dailySessions: Record<string, BookingDocument[]> = {};
    projectBookings.forEach(booking => {
        const dayKey = format(new Date(booking.startTime), 'yyyy-MM-dd');
        if (!dailySessions[dayKey]) dailySessions[dayKey] = [];
        dailySessions[dayKey].push(booking);
    });

    const mergedDailySessions: { day: string, ranges: string[] }[] = [];
    Object.keys(dailySessions).sort().forEach(dayKey => {
        const merged = mergeSessions(dailySessions[dayKey]);
        const ranges = merged.map(session => 
            `${format(session.start, 'HH:mm')} – ${format(session.end, 'HH:mm')}`
        );
        mergedDailySessions.push({ day: format(new Date(dayKey), 'dd/MM/yyyy', { locale: ptBR }), ranges });
    });

    const costMetrics = calculateProjectCost(projectBookings, project);
    if (!costMetrics) {
      toast({ title: "Erro ao calcular custo", description: "Não foi possível gerar o recibo.", variant: "destructive"});
      return;
    }

    let receipt = `RECIBO DE SERVIÇOS\n`;
    receipt += `----------------------------------------\n`;
    receipt += `Cliente: ${client.name}\n`;
    receipt += `Projeto: ${project.name}\n\n`;
    receipt += `DATAS E HORÁRIOS DAS SESSÕES:\n`;
    mergedDailySessions.forEach(sessionDay => {
        receipt += `- ${sessionDay.day}: ${sessionDay.ranges.join(', ')}\n`;
    });
    receipt += `\n`;
    receipt += `DETALHAMENTO FINANCEIRO:\n`;
    receipt += `- Total de Horas: ${costMetrics.totalHours.toFixed(1)}h\n`;
    receipt += `- Valor por Hora: R$${costMetrics.pricePerHour.toFixed(2)}\n`;
    receipt += `----------------------------------------\n`;
    receipt += `VALOR TOTAL: R$${costMetrics.totalAmount.toFixed(2)}\n`;

    setReceiptDetails({ clientName: client.name, projectName: project.name });
    setReceiptText(receipt);
    setIsReceiptModalOpen(true);
  };
  
  const handleCopyReceipt = () => {
    navigator.clipboard.writeText(receiptText);
    toast({ title: "Recibo Copiado!", description: "O texto do recibo foi copiado para a área de transferência." });
  };

  if (!isDataLoaded) {
    return <div className="flex h-screen items-center justify-center p-8">Carregando dados...</div>;
  }

  return (
    <Suspense fallback={<div className="p-8">Carregando página de gerenciamento...</div>}>
      <div className="flex flex-col min-h-screen bg-background text-foreground">
        <main className="flex-grow container mx-auto py-8 px-4">
          <div className="mb-6">
            <Link href="/" passHref>
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para o Calendário
              </Button>
            </Link>
          </div>

          <div className="flex justify-between items-center mb-8">
            <h2 className="text-3xl font-bold text-primary-foreground">Gerenciar Clientes e Projetos</h2>
            <Button onClick={() => handleOpenClientModal()} className="bg-accent hover:bg-accent/90 text-accent-foreground">
              <PlusCircle className="mr-2 h-5 w-5" /> Adicionar Novo Cliente
            </Button>
          </div>

          {clients.filter(c => c.id !== 'client_internal_000').length === 0 && <p className="text-muted-foreground">Nenhum cliente encontrado. Comece adicionando um!</p>}

          {clients.filter(c => c.id !== 'client_internal_000').map(client => (
            <Card key={client.id} className="mb-8 shadow-lg">
              <CardHeader className="bg-card/50 rounded-t-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-2xl text-primary">{client.name}</CardTitle>
                    <CardDescription className="text-muted-foreground">{client.phone}</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => handleOpenClientModal(client)} variant="outline" size="sm" className="border-primary text-primary hover:bg-primary hover:text-primary-foreground">
                      <Pencil className="mr-1 h-4 w-4" /> Editar Cliente
                    </Button>
                     <Button onClick={() => handleOpenDeleteClientDialog(client.id)} variant="destructive" size="sm">
                      <Trash2 className="mr-1 h-4 w-4" /> Excluir Cliente
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-semibold text-primary-foreground">Projetos</h3>
                  <Button onClick={() => handleOpenProjectModal(null, client.id)} variant="default" size="sm" className="bg-accent hover:bg-accent/90 text-accent-foreground">
                    <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Projeto para {client.name.split(' ')[0]}
                  </Button>
                </div>

                {projects.filter(p => p.clientId === client.id && p.id !== 'project_general_calendar').length === 0 && (
                  <p className="text-muted-foreground">Nenhum projeto para este cliente ainda.</p>
                )}

                {projects
                  .filter(p => p.clientId === client.id && p.id !== 'project_general_calendar')
                  .map(project => {
                    const projectBookings = bookings.filter(b => b.projectId === project.id);
                    const projectMetrics = calculateProjectCost(projectBookings, project);
                    
                    const totalBookedHours = projectMetrics?.totalHours || 0;
                    const targetHours = project.targetHours || 0;
                    const progressPercentage = targetHours > 0 ? Math.min((totalBookedHours / targetHours) * 100, 100) : 0;
                    const isCompleted = targetHours > 0 && totalBookedHours >= targetHours;
                    const status = isCompleted ? 'Completo' : 'Em Execução';

                    return (
                      <Accordion type="single" collapsible className="w-full mb-4 border border-border rounded-md" key={project.id}>
                        <AccordionItem value={project.id} className="border-b-0">
                          <AccordionTrigger className="hover:no-underline bg-secondary/30 hover:bg-secondary/50 px-4 py-3 rounded-t-md">
                            <div className="flex justify-between w-full items-center">
                              <span className="font-medium text-lg text-primary-foreground">{project.name}</span>
                              <span className="text-xs text-muted-foreground pr-2">
                                Criado: {format(new Date(project.createdAt), 'd MMM, yyyy', { locale: ptBR })}
                              </span>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="px-4 py-4 bg-card rounded-b-md">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                               <div className="space-y-1">
                                  <p className="text-sm"><strong className="text-muted-foreground">Tipo de Cobrança:</strong> <span className="font-medium">{project.billingType}</span></p>
                                  {project.billingType === 'pacote' && project.pacoteSelecionado && (
                                  <p className="text-sm"><strong className="text-muted-foreground">Pacote:</strong> <span className="font-medium">{project.pacoteSelecionado}</span></p>
                                  )}
                                  {projectMetrics && (
                                    <>
                                      <p className="text-sm"><strong className="text-muted-foreground">Valor por Hora:</strong> <span className="font-medium">R${projectMetrics.pricePerHour.toFixed(2)}</span></p>
                                      <p className="text-sm"><strong className="text-muted-foreground">Valor Total Atual:</strong> <span className="font-semibold text-accent">R${projectMetrics.totalAmount.toFixed(2)}</span></p>
                                    </>
                                  )}
                              </div>
                              <div className="flex md:justify-end items-start gap-2">
                                  <Button onClick={() => handleOpenProjectModal(project, client.id)} variant="outline" size="sm" className="border-accent text-accent hover:bg-accent hover:text-accent-foreground">
                                  <Pencil className="mr-1 h-4 w-4" /> Editar Projeto
                                  </Button>
                                  <Button onClick={() => handleOpenDeleteProjectDialog(project.id)} variant="destructive" size="sm" className="bg-destructive/80 hover:bg-destructive">
                                  <Trash2 className="mr-1 h-4 w-4" /> Excluir Projeto
                                  </Button>
                              </div>
                            </div>
                            
                            <div className="mt-4 space-y-3 p-3 bg-secondary/20 rounded-md">
                              <div className="flex justify-between items-center">
                                <p className="text-sm font-medium">Status do Projeto:</p>
                                <span className={`text-sm font-semibold px-2 py-1 rounded-full ${isCompleted ? 'bg-green-500/20 text-green-300' : 'bg-yellow-500/20 text-yellow-300'}`}>
                                    {status}
                                </span>
                              </div>
                              <div>
                                  <div className="flex justify-between text-sm text-muted-foreground mb-1">
                                      <span>Progresso das Horas</span>
                                      <span>{totalBookedHours.toFixed(1)} / {targetHours}h</span>
                                  </div>
                                  <Progress value={progressPercentage} className="h-2" />
                              </div>
                              {isCompleted && (
                                  <div className="pt-2 flex justify-end">
                                      <Button 
                                          onClick={() => handleGenerateReceipt(project, client)}
                                          variant="outline"
                                          size="sm"
                                          className="border-green-400 text-green-400 hover:bg-green-500 hover:text-white"
                                      >
                                          <FileText className="mr-2 h-4 w-4" />
                                          Gerar Recibo
                                      </Button>
                                  </div>
                              )}
                            </div>

                            <h4 className="text-md font-semibold mt-6 mb-2 text-primary-foreground">Agendamentos para este projeto:</h4>
                            {projectBookings.length > 0 ? (
                              <div className="overflow-x-auto rounded-md border border-border">
                                <Table>
                                  <TableHeader className="bg-muted/30">
                                    <TableRow>
                                      <TableHead className="text-foreground">Horário de Início</TableHead>
                                      <TableHead className="text-foreground">Horário de Fim</TableHead>
                                      <TableHead className="text-foreground text-right">Duração (hrs)</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {projectBookings
                                      .sort((a,b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
                                      .map(booking => (
                                        <TableRow key={booking.id} className="hover:bg-muted/10">
                                          <TableCell>{format(new Date(booking.startTime), 'd MMM, yyyy HH:mm', { locale: ptBR })}</TableCell>
                                          <TableCell>{format(new Date(booking.endTime), 'd MMM, yyyy HH:mm', { locale: ptBR })}</TableCell>
                                          <TableCell className="text-right">{booking.duration.toFixed(1)}</TableCell>
                                        </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            ) : (
                              <p className="text-muted-foreground">Nenhum agendamento para este projeto ainda.</p>
                            )}
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                  )})}
              </CardContent>
            </Card>
          ))}
        </main>
      </div>

      {/* Client Add/Edit Modal */}
      <Dialog open={isClientModalOpen} onOpenChange={setIsClientModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingClient ? 'Editar Cliente' : 'Adicionar Novo Cliente'}</DialogTitle>
            <DialogDescription>
              {editingClient ? 'Atualize as informações do cliente.' : 'Preencha as informações do novo cliente.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={clientForm.handleSubmit(onClientSubmit)}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">Nome</Label>
                <Input id="name" {...clientForm.register('name')} className="col-span-3" />
              </div>
              {clientForm.formState.errors.name && <p className="col-span-4 text-right text-destructive text-sm">{clientForm.formState.errors.name.message}</p>}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="phone" className="text-right">Telefone</Label>
                <Input id="phone" {...clientForm.register('phone')} className="col-span-3" />
              </div>
              {clientForm.formState.errors.phone && <p className="col-span-4 text-right text-destructive text-sm">{clientForm.formState.errors.phone.message}</p>}
            </div>
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="secondary">Cancelar</Button></DialogClose>
              <Button type="submit">Salvar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Project Add/Edit Modal */}
      <Dialog open={isProjectModalOpen} onOpenChange={setIsProjectModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingProject ? 'Editar Projeto' : 'Adicionar Novo Projeto'}</DialogTitle>
            <DialogDescription>
              Preencha os detalhes do projeto abaixo.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={projectForm.handleSubmit(onProjectSubmit)}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="projectName">Nome do Projeto</Label>
                <Input id="projectName" {...projectForm.register('name')} />
                {projectForm.formState.errors.name && <p className="text-destructive text-sm">{projectForm.formState.errors.name.message}</p>}
              </div>

              <div className="space-y-2">
                <Label>Tipo de Cobrança</Label>
                <Controller
                  control={projectForm.control}
                  name="billingType"
                  render={({ field }) => (
                    <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="personalizado" id="r-custom"/>
                        <Label htmlFor="r-custom">Personalizado</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="pacote" id="r-package"/>
                        <Label htmlFor="r-package">Pacote</Label>
                      </div>
                    </RadioGroup>
                  )}
                />
              </div>

              {watchedBillingType === 'personalizado' && (
                <div className="space-y-2">
                  <Label htmlFor="customRate">Valor por Hora (R$)</Label>
                  <Input id="customRate" type="number" {...projectForm.register('customRate')} />
                   {projectForm.formState.errors.customRate && <p className="text-destructive text-sm">{projectForm.formState.errors.customRate.message}</p>}
                </div>
              )}

              {watchedBillingType === 'pacote' && (
                <div className="space-y-2">
                  <Label>Pacote Selecionado</Label>
                  <Controller
                    control={projectForm.control}
                    name="pacoteSelecionado"
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger><SelectValue placeholder="Selecione um pacote" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Avulso">Avulso (R$350/hr)</SelectItem>
                          <SelectItem value="Pacote 10h">Pacote 10h (R$260/hr)</SelectItem>
                          <SelectItem value="Pacote 20h">Pacote 20h (R$230/hr)</SelectItem>
                          <SelectItem value="Pacote 40h">Pacote 40h (R$160/hr)</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {projectForm.formState.errors.pacoteSelecionado && <p className="text-destructive text-sm">{projectForm.formState.errors.pacoteSelecionado.message}</p>}
                </div>
              )}
              <div className="space-y-2">
                  <Label htmlFor="targetHours">Meta de Horas do Projeto</Label>
                  <Input id="targetHours" type="number" {...projectForm.register('targetHours')} placeholder="ex: 20"/>
                  {projectForm.formState.errors.targetHours && <p className="text-destructive text-sm">{projectForm.formState.errors.targetHours.message}</p>}
                </div>
            </div>
             <DialogFooter>
                <DialogClose asChild><Button type="button" variant="secondary">Cancelar</Button></DialogClose>
                <Button type="submit">Salvar Projeto</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* Delete Client Confirmation */}
      <AlertDialog open={isDeleteClientDialogOpen} onOpenChange={setIsDeleteClientDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Isso excluirá permanentemente o cliente, junto com todos os seus projetos e agendamentos associados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteClient}>Continuar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Project Confirmation */}
      <AlertDialog open={isDeleteProjectDialogOpen} onOpenChange={setIsDeleteProjectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Isso excluirá permanentemente o projeto e todos os seus agendamentos associados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteProject}>Continuar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Receipt Modal */}
      <Dialog open={isReceiptModalOpen} onOpenChange={setIsReceiptModalOpen}>
        <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
                <DialogTitle>Recibo para {receiptDetails?.projectName}</DialogTitle>
                <DialogDescription>
                    Cliente: {receiptDetails?.clientName}. Verifique os detalhes abaixo.
                </DialogDescription>
            </DialogHeader>
            <div className="my-4">
                <Label htmlFor="receipt-text">Conteúdo do Recibo</Label>
                <Textarea
                    id="receipt-text"
                    readOnly
                    value={receiptText}
                    className="h-80 font-mono text-sm bg-muted/50 resize-none"
                />
            </div>
            <DialogFooter className="gap-2 sm:justify-start">
                <Button onClick={handleCopyReceipt}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copiar Texto
                </Button>
                <DialogClose asChild>
                    <Button type="button" variant="secondary">
                        Fechar
                    </Button>
                </DialogClose>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    </Suspense>
  );
}
