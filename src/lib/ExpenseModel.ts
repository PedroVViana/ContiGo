export interface ExpenseSplit {
  partnerId: string;
  partnerName: string;
  percentage: number;
  paid: boolean; // Indica se este participante já pagou sua parte
  paidAt?: Date; // Data do pagamento
}

export interface Expense {
  id?: string;
  description: string;
  amount: number;
  paidBy: string; // Nome de quem pagou
  paidById: string; // ID de quem pagou
  date: Date;
  category: string;
  splits: ExpenseSplit[]; // Divisão entre participantes
  userId: string; // ID do usuário que criou a despesa
  status: 'pendente' | 'concluida'; // Status geral da despesa
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Partner {
  id?: string;
  userId: string; // ID do usuário que criou o parceiro
  name: string;
  email: string;
  status: 'pendente' | 'ativo' | 'recusado';
  createdAt?: Date;
  updatedAt?: Date;
} 