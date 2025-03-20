'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { collection, addDoc, query, where, onSnapshot, deleteDoc, doc, updateDoc, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Expense, ExpenseSplit, Partner } from '@/lib/ExpenseModel';
import toast from 'react-hot-toast';

export default function Dashboard() {
  const { currentUser, logout, loading } = useAuth();
  const router = useRouter();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [newExpense, setNewExpense] = useState<Omit<Expense, 'id'>>({
    description: '',
    amount: 0,
    paidBy: '',
    paidById: '',
    date: new Date(),
    category: 'Alimentação',
    splits: [],
    status: 'pendente',
    userId: currentUser?.uid || ''
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<string | null>(null);
  const [selectedPartners, setSelectedPartners] = useState<string[]>([]);
  const [tempSplits, setTempSplits] = useState<{[key: string]: number}>({});
  const [splitTotal, setSplitTotal] = useState(0);
  
  // Definir cores para categorias de despesas
  const categoryColors: {[key: string]: string} = {
    'Alimentação': 'bg-green-100 text-green-800',
    'Moradia': 'bg-blue-100 text-blue-800',
    'Transporte': 'bg-yellow-100 text-yellow-800',
    'Lazer': 'bg-purple-100 text-purple-800',
    'Saúde': 'bg-red-100 text-red-800',
    'Educação': 'bg-indigo-100 text-indigo-800',
    'Vestuário': 'bg-pink-100 text-pink-800',
    'Outros': 'bg-gray-100 text-gray-800'
  };

  // Redirecionar se o usuário não estiver logado
  useEffect(() => {
    if (!loading && !currentUser) {
      router.push('/login');
    }
  }, [currentUser, loading, router]);

  // Carregar parceiros do Firestore
  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, 'partners'),
      where('userId', '==', currentUser.uid),
      where('status', '==', 'ativo')
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const partnersData: Partner[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        partnersData.push({
          id: doc.id,
          name: data.name,
          email: data.email,
          status: data.status,
          userId: data.userId || currentUser.uid
        });
      });
      setPartners(partnersData);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Carregar despesas do Firestore
  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, 'expenses'),
      where('userId', '==', currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const expensesData: Expense[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        expensesData.push({
          id: doc.id,
          description: data.description,
          amount: data.amount,
          paidBy: data.paidBy,
          paidById: data.paidById,
          date: data.date.toDate(),
          category: data.category,
          splits: data.splits || [],
          status: data.status || 'pendente', // Valor padrão para despesas antigas
          userId: data.userId
        });
      });
      setExpenses(expensesData);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Filtrar despesas por status
  const pendingExpenses = expenses.filter(expense => 
    expense.status === 'pendente' || !expense.status
  );
  
  const completedExpenses = expenses.filter(expense => 
    expense.status === 'concluida'
  );

  // Calcular estatísticas para cards dinâmicos
  const calculateStats = () => {
    // Total de despesas pendentes e concluídas
    const totalPending = pendingExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    const totalCompleted = completedExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    
    // Calcular o total por categoria
    const categoryCounts: { [key: string]: { count: number, amount: number } } = {};
    expenses.forEach(expense => {
      if (!categoryCounts[expense.category]) {
        categoryCounts[expense.category] = { count: 0, amount: 0 };
      }
      categoryCounts[expense.category].count += 1;
      categoryCounts[expense.category].amount += expense.amount;
    });
    
    // Ordenar categorias por valor total
    const sortedCategories = Object.entries(categoryCounts)
      .sort((a, b) => b[1].amount - a[1].amount)
      .slice(0, 5); // Top 5 categorias
    
    // Calcular o progresso de pagamentos
    const totalExpenseCount = expenses.length;
    const completedCount = completedExpenses.length;
    const completionRate = totalExpenseCount > 0 ? (completedCount / totalExpenseCount) * 100 : 0;
    
    return {
      totalPending,
      totalCompleted,
      sortedCategories,
      completionRate
    };
  };
  
  const stats = calculateStats();

  // Recalcular o total das divisões quando mudarem
  useEffect(() => {
    const total = Object.values(tempSplits).reduce((sum, value) => sum + value, 0);
    setSplitTotal(total);
  }, [tempSplits]);

  // Inicializar uma nova despesa
  const initializeNewExpense = () => {
    if (!currentUser) return;
    
    setNewExpense({
      description: '',
      amount: 0,
      paidBy: currentUser.displayName || 'Você',
      paidById: currentUser.uid,
      date: new Date(),
      category: 'Alimentação',
      splits: [],
      status: 'pendente',
      userId: currentUser.uid
    });
    
    setSelectedPartners([]);
    setTempSplits({
      [currentUser.uid]: 100 // Inicializa com 100% para o usuário
    });
    setSplitTotal(0);
  };

  // Alternar a seleção de um parceiro
  const togglePartnerSelection = (partnerId: string) => {
    const isCurrentlySelected = selectedPartners.includes(partnerId);
    let newSelectedPartners: string[];
    let newTempSplits = {...tempSplits};
    
    if (isCurrentlySelected) {
      // Removendo o parceiro
      newSelectedPartners = selectedPartners.filter(id => id !== partnerId);
      delete newTempSplits[partnerId];
      
      // Redistribuir a porcentagem entre os participantes restantes
      const totalParticipants = newSelectedPartners.length + 1; // +1 para o usuário
      if (totalParticipants > 0) {
        const equalShare = 100 / totalParticipants;
        if (currentUser) {
          newTempSplits[currentUser.uid] = equalShare;
        }
        newSelectedPartners.forEach(id => {
          newTempSplits[id] = equalShare;
        });
      }
    } else {
      // Adicionando o parceiro
      newSelectedPartners = [...selectedPartners, partnerId];
      
      // Redistribuir a porcentagem entre todos os participantes
      const totalParticipants = newSelectedPartners.length + 1; // +1 para o usuário
      const equalShare = 100 / totalParticipants;
      
      if (currentUser) {
        newTempSplits[currentUser.uid] = equalShare;
      }
      newSelectedPartners.forEach(id => {
        newTempSplits[id] = equalShare;
      });
    }
    
    setSelectedPartners(newSelectedPartners);
    setTempSplits(newTempSplits);
  };

  // Atualizar a porcentagem de um parceiro
  const updatePartnerPercentage = (partnerId: string, percentage: number) => {
    setTempSplits({...tempSplits, [partnerId]: percentage});
  };

  // Preparar splits antes de salvar
  const prepareSplitsForSave = () => {
    if (!currentUser) return [];
    
    const splits: ExpenseSplit[] = [];
    
    // Adicionar o usuário como participante (inicialmente não pago)
    splits.push({
      partnerId: currentUser.uid,
      partnerName: currentUser.displayName || 'Você',
      percentage: tempSplits[currentUser.uid] || 0,
      paid: false // O usuário também começa como não tendo pago
    });
    
    // Adicionar parceiros selecionados
    selectedPartners.forEach(partnerId => {
      const partner = partners.find(p => p.id === partnerId);
      if (partner) {
        splits.push({
          partnerId: partner.id || '',  // Garantir que não seja undefined
          partnerName: partner.name,
          percentage: tempSplits[partner.id || ''] || 0,
          paid: false // Parceiros começam como não tendo pago
        });
      }
    });
    
    return splits;
  };

  // Adicionar uma nova despesa
  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentUser) return;

    // Verificar se a soma das porcentagens é 100%
    const totalPercentage = Object.values(tempSplits).reduce((sum, value) => sum + value, 0);
    
    if (Math.abs(totalPercentage - 100) > 0.01) { // Pequena margem para erros de arredondamento
      alert('A soma das porcentagens deve ser exatamente 100%');
      return;
    }

    const splits = prepareSplitsForSave();

    try {
      if (editingExpense) {
        // Atualizar despesa existente
        await updateDoc(doc(db, 'expenses', editingExpense), {
          description: newExpense.description,
          amount: newExpense.amount,
          paidBy: newExpense.paidBy,
          paidById: newExpense.paidById,
          date: newExpense.date,
          category: newExpense.category,
          splits: splits,
          status: 'pendente', // Reset status to pending when edited
          updatedAt: new Date()
        });
        setEditingExpense(null);
      } else {
        // Adicionar nova despesa
        await addDoc(collection(db, 'expenses'), {
          description: newExpense.description,
          amount: newExpense.amount,
          paidBy: newExpense.paidBy,
          paidById: newExpense.paidById,
          date: newExpense.date,
          category: newExpense.category,
          splits: splits,
          status: 'pendente',
          userId: currentUser.uid,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
      
      // Limpar formulário e fechar o modal de forma controlada
      setIsModalOpen(false); // Fechar o modal primeiro
      // Resetar os estados relacionados à despesa
      setTimeout(() => {
        initializeNewExpense();
      }, 100); // Pequeno atraso para evitar abertura inadvertida
    } catch (error) {
      console.error('Erro ao adicionar despesa:', error);
    }
  };

  // Excluir despesa
  const handleDeleteExpense = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta despesa?')) {
      try {
        await deleteDoc(doc(db, 'expenses', id));
      } catch (error) {
        console.error('Erro ao excluir despesa:', error);
      }
    }
  };

  // Editar despesa
  const handleEditExpense = (expense: Expense) => {
    setNewExpense({
      description: expense.description,
      amount: expense.amount,
      paidBy: expense.paidBy,
      paidById: expense.paidById,
      date: expense.date,
      category: expense.category,
      splits: expense.splits,
      status: expense.status,
      userId: expense.userId
    });
    
    // Configurar os parceiros selecionados e suas divisões
    const selectedIds = expense.splits
      .filter(split => split.partnerId !== currentUser?.uid)
      .map(split => split.partnerId);
    
    setSelectedPartners(selectedIds);
    
    const splitValues: {[key: string]: number} = {};
    expense.splits.forEach(split => {
      if (split.partnerId !== currentUser?.uid) {
        splitValues[split.partnerId] = split.percentage;
      }
    });
    
    setTempSplits(splitValues);
    setEditingExpense(expense.id as string);
    setIsModalOpen(true);
  };

  // Calcular totais de forma mais detalhada
  const calculateDetailedTotals = () => {
    let totalPaid = 0;
    let userPaid = 0;
    let userOwesMap: {[key: string]: number} = {};
    let partnersOweMap: {[key: string]: number} = {};
    
    // Inicializar mapas com zero para todos os parceiros
    partners.forEach(partner => {
      if (partner.id) {  // Verificar se id existe
        userOwesMap[partner.id] = 0;
        partnersOweMap[partner.id] = 0;
      }
    });
    
    const detailedExpenses = expenses.map(expense => {
      const total = expense.amount;
      totalPaid += total;
      
      // Encontrar a divisão do usuário
      const userSplit = expense.splits.find(split => split.partnerId === currentUser?.uid);
      const userPercentage = userSplit ? userSplit.percentage : 0;
      
      // Calcular os valores por parceiro
      const partnerDetails = expense.splits
        .filter(split => split.partnerId !== currentUser?.uid)
        .map(split => {
          const partnerAmount = (total * split.percentage / 100);
          return {
            partnerId: split.partnerId,
            partnerName: split.partnerName,
            percentage: split.percentage,
            amount: partnerAmount
          };
        });
      
      // Atualizar saldos baseado em quem pagou
      if (expense.paidById === currentUser?.uid) {
        // Usuário pagou
        userPaid += total;
        
        // Calcular quanto cada parceiro deve ao usuário
        partnerDetails.forEach(detail => {
          partnersOweMap[detail.partnerId] = (partnersOweMap[detail.partnerId] || 0) + detail.amount;
        });
      } else {
        // Um parceiro pagou
        // Calcular quanto o usuário deve ao parceiro que pagou
        const userAmount = (total * userPercentage / 100);
        userOwesMap[expense.paidById] = (userOwesMap[expense.paidById] || 0) + userAmount;
        
        // Calcular quanto outros parceiros devem ao parceiro que pagou
        partnerDetails.forEach(detail => {
          if (detail.partnerId !== expense.paidById) {
            // Este parceiro deve ao parceiro que pagou
            // Este valor não é diretamente relevante para o usuário, mas pode ser útil para visualização
          }
        });
      }
      
      return {
        ...expense,
        userPercentage,
        userAmount: (total * userPercentage / 100),
        partnerDetails
      };
    });
    
    // Calcular saldos finais
    const balances = partners.map(partner => {
      const partnerOwes = partner.id ? partnersOweMap[partner.id] || 0 : 0;
      const userOwes = partner.id ? userOwesMap[partner.id] || 0 : 0;
      const netBalance = partnerOwes - userOwes;
      
      return {
        partnerId: partner.id || '',  // Garantir que não seja undefined
        partnerName: partner.name,
        partnerOwes,
        userOwes,
        netBalance
      };
    });
    
    return { 
      totalPaid, 
      userPaid,
      balances,
      detailedExpenses 
    };
  };

  const { 
    totalPaid, 
    userPaid,
    balances,
    detailedExpenses 
  } = calculateDetailedTotals();

  // Função específica para inicializar uma nova despesa e abrir o modal
  const openAddExpenseModal = () => {
    initializeNewExpense();
    setIsModalOpen(true);
  };

  // Função específica para fechar o modal sem efeitos colaterais
  const closeAddExpenseModal = () => {
    setIsModalOpen(false);
    setEditingExpense(null);
  };

  // Adicionar verificação de pagamento segura
  const countPaidSplits = (expense: Expense) => {
    return expense.splits.filter(split => 
      (split as any).paid === true
    ).length;
  };

  // Verificar se todos os participantes pagaram
  const allParticipantsPaid = (expense: Expense) => {
    return expense.splits.every(split => split.paid === true);
  };

  // Função para marcar uma despesa como concluída
  const markExpenseAsCompleted = async (expenseId: string) => {
    if (!currentUser) return;
    
    try {
      await updateDoc(doc(db, 'expenses', expenseId), {
        status: 'concluida',
        updatedAt: new Date()
      });
      
      // Atualização otimista da UI
      setExpenses(expenses.map(exp => 
        exp.id === expenseId 
          ? {...exp, status: 'concluida'} 
          : exp
      ));
      
    } catch (error) {
      console.error('Erro ao marcar despesa como concluída:', error);
      alert('Erro ao atualizar a despesa. Tente novamente.');
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  }

  return (
    <div className="min-h-screen bg-[#F7F7F7]">
      {/* Cabeçalho */}
      <header className="bg-[#FF5A5F] text-white p-4 shadow-md">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">ContiGo</h1>
          <nav className="flex items-center space-x-6">
            <a href="/dashboard" className="hover:underline font-bold">Dashboard</a>
            <a href="/parceiros" className="hover:underline">Parceiros</a>
            <a href="/perfil" className="hover:underline">Perfil</a>
            <button 
              onClick={() => logout()}
              className="bg-white text-[#FF5A5F] px-3 py-1 rounded-md hover:bg-gray-100 transition-colors"
            >
              Sair
            </button>
          </nav>
        </div>
      </header>
      
      {/* Conteúdo principal */}
      <main className="container mx-auto p-4 mt-6">
        {/* Cards de Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {/* Card Total Despesas Pendentes */}
          <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-yellow-500">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Total Pendente</h3>
            <p className="text-2xl font-bold text-[#FF5A5F] mb-2">
              R$ {stats.totalPending.toFixed(2)}
            </p>
            <p className="text-sm text-gray-600">
              {pendingExpenses.length} despesas aguardando pagamento
            </p>
          </div>
          
          {/* Card Total Despesas Concluídas */}
          <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-green-500">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Total Concluído</h3>
            <p className="text-2xl font-bold text-green-600 mb-2">
              R$ {stats.totalCompleted.toFixed(2)}
            </p>
            <p className="text-sm text-gray-600">
              {completedExpenses.length} despesas pagas integralmente
            </p>
          </div>
          
          {/* Card Taxa de Conclusão */}
          <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-blue-500">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Taxa de Conclusão</h3>
            <div className="mb-2">
              <div className="h-4 w-full bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 rounded-full" 
                  style={{ width: `${stats.completionRate}%` }}
                ></div>
              </div>
            </div>
            <p className="text-2xl font-bold text-blue-600">
              {stats.completionRate.toFixed(1)}%
            </p>
            <p className="text-sm text-gray-600">
              {completedExpenses.length} de {expenses.length} despesas concluídas
            </p>
          </div>
        </div>
        
        {/* Cards Adicionais */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Card Categorias Mais Comuns */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Principais Categorias</h3>
            <div className="space-y-3">
              {stats.sortedCategories.map(([category, data]) => (
                <div key={category}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-gray-700">{category}</span>
                    <span className="text-sm text-gray-600">R$ {data.amount.toFixed(2)}</span>
                  </div>
                  <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-[#FF5A5F] rounded-full" 
                      style={{ 
                        width: `${(data.amount / expenses.reduce((sum, exp) => sum + exp.amount, 0)) * 100}%` 
                      }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{data.count} despesas</p>
                </div>
              ))}
            </div>
          </div>
          
          {/* Card Status de Pagamentos */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Status de Pagamentos</h3>
            <div className="space-y-4">
              <div className="flex items-center">
                <div className="w-6 h-6 rounded-full bg-yellow-500 mr-3"></div>
                <div className="flex-1">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Pendentes</span>
                    <span className="text-sm">{pendingExpenses.length}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center">
                <div className="w-6 h-6 rounded-full bg-green-500 mr-3"></div>
                <div className="flex-1">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Concluídas</span>
                    <span className="text-sm">{completedExpenses.length}</span>
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <div className="h-10 w-full bg-gray-200 rounded-lg overflow-hidden flex">
                  <div 
                    className="h-full bg-yellow-500" 
                    style={{ 
                      width: `${expenses.length ? (pendingExpenses.length / expenses.length) * 100 : 0}%` 
                    }}
                  ></div>
                  <div 
                    className="h-full bg-green-500" 
                    style={{ 
                      width: `${expenses.length ? (completedExpenses.length / expenses.length) * 100 : 0}%` 
                    }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Despesas Pendentes */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden mb-8">
          <div className="p-6 bg-[#FFECEC] border-b">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-800">Despesas Pendentes</h3>
              <button 
                onClick={openAddExpenseModal}
                className="bg-[#FF5A5F] text-white px-4 py-2 rounded-md hover:bg-[#E54A4F] transition-colors"
              >
                Adicionar Despesa
              </button>
            </div>
          </div>
          
          {/* Tabela de despesas pendentes */}
          <div className="mt-8 overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
            <div className="min-w-full divide-y divide-gray-300">
              <div className="bg-gray-50">
                <div className="grid grid-cols-7 divide-x divide-gray-200">
                  <div className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Descrição</div>
                  <div className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Valor</div>
                  <div className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Data</div>
                  <div className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Pago por</div>
                  <div className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Categoria</div>
                  <div className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Status de Pagamento</div>
                  <div className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Ações</div>
                </div>
              </div>
              <div className="divide-y divide-gray-200 bg-white">
                {pendingExpenses.length === 0 ? (
                  <div className="px-3 py-4 text-sm text-gray-500 text-center col-span-7">
                    Nenhuma despesa pendente encontrada.
                  </div>
                ) : (
                  pendingExpenses.map((expense) => (
                    <div key={expense.id} className="grid grid-cols-7 divide-x divide-gray-200">
                      <div className="px-3 py-4 text-sm text-gray-500">{expense.description}</div>
                      <div className="px-3 py-4 text-sm font-medium text-gray-900">
                        {expense.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </div>
                      <div className="px-3 py-4 text-sm text-gray-500">
                        {new Date(expense.date).toLocaleDateString('pt-BR')}
                      </div>
                      <div className="px-3 py-4 text-sm text-gray-500">{expense.paidBy}</div>
                      <div className="px-3 py-4 text-sm text-gray-500">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          categoryColors[expense.category] || 'bg-gray-100 text-gray-800'
                        }`}>
                          {expense.category}
                        </span>
                      </div>
                      <div className="px-3 py-4 text-sm text-gray-500">
                        {/* Status de pagamento com barra de progresso */}
                        <div className="flex flex-col">
                          <div className="text-xs mb-1">
                            {countPaidSplits(expense)}/{expense.splits.length} pagos
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full" 
                              style={{ width: `${(countPaidSplits(expense) / expense.splits.length) * 100}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                      <div className="px-3 py-4 text-sm text-gray-500 flex space-x-2">
                        <button
                          onClick={() => router.push(`/despesa/${expense.id}`)}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          Ver
                        </button>
                        <button
                          onClick={() => handleEditExpense(expense)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleDeleteExpense(expense.id as string)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Excluir
                        </button>
                        {allParticipantsPaid(expense) && (
                          <button
                            onClick={() => markExpenseAsCompleted(expense.id as string)}
                            className="text-green-600 hover:text-green-900"
                          >
                            Concluir
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Adicionar seção para despesas concluídas */}
        <div className="mt-12">
          <h2 className="text-lg font-medium text-gray-900 mb-2">Despesas Concluídas</h2>
          <p className="text-sm text-gray-500 mb-4">
            Lista de despesas em que todos os participantes já pagaram suas partes.
          </p>
          
          <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
            <div className="min-w-full divide-y divide-gray-300">
              <div className="bg-gray-50">
                <div className="grid grid-cols-6 divide-x divide-gray-200">
                  <div className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Descrição</div>
                  <div className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Valor</div>
                  <div className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Data</div>
                  <div className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Pago por</div>
                  <div className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Categoria</div>
                  <div className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Ações</div>
                </div>
              </div>
              <div className="divide-y divide-gray-200 bg-white">
                {completedExpenses.length === 0 ? (
                  <div className="px-3 py-4 text-sm text-gray-500 text-center col-span-6">
                    Nenhuma despesa concluída.
                  </div>
                ) : (
                  completedExpenses.map((expense) => (
                    <div key={expense.id} className="grid grid-cols-6 divide-x divide-gray-200">
                      <div className="px-3 py-4 text-sm text-gray-500">{expense.description}</div>
                      <div className="px-3 py-4 text-sm font-medium text-gray-900">
                        {expense.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </div>
                      <div className="px-3 py-4 text-sm text-gray-500">
                        {new Date(expense.date).toLocaleDateString('pt-BR')}
                      </div>
                      <div className="px-3 py-4 text-sm text-gray-500">{expense.paidBy}</div>
                      <div className="px-3 py-4 text-sm text-gray-500">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          categoryColors[expense.category] || 'bg-gray-100 text-gray-800'
                        }`}>
                          {expense.category}
                        </span>
                      </div>
                      <div className="px-3 py-4 text-sm text-gray-500 flex space-x-2">
                        <button
                          onClick={() => router.push(`/despesa/${expense.id}`)}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          Ver
                        </button>
                        <button
                          onClick={() => handleDeleteExpense(expense.id as string)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Excluir
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
      
      {/* Modal de Adicionar Despesa */}
      {/* Modal para adicionar/editar despesa */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="border-b px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingExpense ? 'Editar Despesa' : 'Adicionar Nova Despesa'}
              </h3>
            </div>
            
            <form onSubmit={handleAddExpense} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                    Descrição
                  </label>
                  <input
                    type="text"
                    id="description"
                    value={newExpense.description}
                    onChange={(e) => setNewExpense({...newExpense, description: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-[#FF5A5F] focus:border-[#FF5A5F]"
                    required
                  />
                </div>
                
                <div>
                  <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1">
                    Valor (R$)
                  </label>
                  <input
                    type="number"
                    id="amount"
                    value={newExpense.amount}
                    onChange={(e) => setNewExpense({...newExpense, amount: parseFloat(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-[#FF5A5F] focus:border-[#FF5A5F]"
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label htmlFor="paidBy" className="block text-sm font-medium text-gray-700 mb-1">
                    Pago por
                  </label>
                  <select
                    id="paidBy"
                    value={newExpense.paidById}
                    onChange={(e) => {
                      const partnerId = e.target.value;
                      let paidByName = "Você";
                      
                      if (partnerId === currentUser?.uid) {
                        paidByName = currentUser?.displayName || "Você";
                      } else {
                        const partner = partners.find(p => p.id === partnerId);
                        paidByName = partner?.name || "";
                      }
                      
                      setNewExpense({
                        ...newExpense, 
                        paidById: partnerId,
                        paidBy: paidByName
                      });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-[#FF5A5F] focus:border-[#FF5A5F]"
                    required
                  >
                    <option value={currentUser?.uid || ''}>{currentUser?.displayName || 'Você'}</option>
                    {partners.map(partner => (
                      <option key={partner.id} value={partner.id}>{partner.name}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
                    Categoria
                  </label>
                  <select
                    id="category"
                    value={newExpense.category}
                    onChange={(e) => setNewExpense({...newExpense, category: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-[#FF5A5F] focus:border-[#FF5A5F]"
                  >
                    <option value="Alimentação">Alimentação</option>
                    <option value="Moradia">Moradia</option>
                    <option value="Transporte">Transporte</option>
                    <option value="Lazer">Lazer</option>
                    <option value="Saúde">Saúde</option>
                    <option value="Educação">Educação</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Selecione os parceiros que participam desta despesa
                </label>
                {partners.length === 0 ? (
                  <p className="text-gray-500 text-sm bg-gray-50 p-3 rounded-md">
                    Você não tem parceiros ativos. <a href="/parceiros" className="text-[#FF5A5F] underline">Adicione parceiros</a> para dividir despesas.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {partners.map(partner => (
                      <div 
                        key={partner.id || `partner-${Math.random()}`} 
                        className={`p-3 rounded-md border cursor-pointer transition-colors ${
                          partner.id && selectedPartners.includes(partner.id) ? 'border-[#FF5A5F] bg-red-50' : 'border-gray-300 hover:bg-gray-50'
                        }`}
                        onClick={() => partner.id && togglePartnerSelection(partner.id)}
                      >
                        <div className="flex justify-between items-center">
                          <div className="flex items-center">
                            <input 
                              type="checkbox" 
                              checked={partner.id ? selectedPartners.includes(partner.id) : false}
                              onChange={() => {}}
                              className="h-4 w-4 text-[#FF5A5F] focus:ring-[#FF5A5F] border-gray-300 rounded"
                            />
                            <span className="ml-2 font-medium">{partner.name}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Definir porcentagens */}
              {selectedPartners.length > 0 && (
                <div className="mt-4">
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Definir porcentagens
                    </label>
                    <span className={`text-sm font-medium ${
                      Math.abs(Object.values(tempSplits).reduce((sum, val) => sum + val, 0) - 100) < 0.01 
                        ? 'text-green-500' 
                        : 'text-red-500'
                    }`}>
                      Total: {Object.values(tempSplits).reduce((sum, val) => sum + val, 0).toFixed(1)}%
                    </span>
                  </div>
                  
                  <div className="bg-gray-50 p-3 rounded-md">
                    <div className="grid grid-cols-[2fr,1fr,1fr,1fr] gap-2 mb-2 text-xs font-medium bg-gray-200 p-2 rounded">
                      <div>Participante</div>
                      <div>Porcentagem</div>
                      <div>Slider</div>
                      <div>Valor (R$)</div>
                    </div>
                    
                    {/* Usuário atual */}
                    {currentUser && (
                      <div className="grid grid-cols-[2fr,1fr,1fr,1fr] gap-2 items-center pb-2 mb-2 border-b">
                        <div className="text-sm font-medium">
                          {currentUser.displayName || 'Você'}
                        </div>
                        <div className="flex items-center">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            className="w-14 p-1 border rounded"
                            value={tempSplits[currentUser.uid] || 0}
                            onChange={(e) => updatePartnerPercentage(currentUser.uid, Number(e.target.value))}
                          />
                          <span className="ml-1">%</span>
                        </div>
                        <div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            className="w-full"
                            value={tempSplits[currentUser.uid] || 0}
                            onChange={(e) => updatePartnerPercentage(currentUser.uid, Number(e.target.value))}
                          />
                        </div>
                        <div className="text-sm">
                          R$ {((newExpense.amount * (tempSplits[currentUser.uid] || 0)) / 100).toFixed(2)}
                        </div>
                      </div>
                    )}
                    
                    {/* Parceiros selecionados */}
                    {selectedPartners.map(partnerId => {
                      const partner = partners.find(p => p.id === partnerId);
                      if (!partner || !partner.id) return null;
                      
                      return (
                        <div key={partner.id} className="grid grid-cols-[2fr,1fr,1fr,1fr] gap-2 items-center pb-2 mb-2 border-b">
                          <div className="text-sm font-medium">
                            {partner.name}
                          </div>
                          <div className="flex items-center">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              className="w-14 p-1 border rounded"
                              value={tempSplits[partner.id] || 0}
                              onChange={(e) => partner.id && updatePartnerPercentage(partner.id, Number(e.target.value))}
                            />
                            <span className="ml-1">%</span>
                          </div>
                          <div>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              className="w-full"
                              value={tempSplits[partner.id] || 0}
                              onChange={(e) => partner.id && updatePartnerPercentage(partner.id, Number(e.target.value))}
                            />
                          </div>
                          <div className="text-sm">
                            R$ {((newExpense.amount * (tempSplits[partner.id] || 0)) / 100).toFixed(2)}
                          </div>
                        </div>
                      );
                    })}
                    
                    <div className="mt-2 text-xs text-gray-600">
                      <p>Nota: A soma das porcentagens deve ser exatamente 100%</p>
                      <button 
                        type="button"
                        onClick={() => {
                          // Distribuir igualmente entre todos os participantes
                          const totalParticipants = selectedPartners.length + 1; // +1 para o usuário
                          const equalShare = 100 / totalParticipants;
                          
                          const newSplits: {[key: string]: number} = {};
                          if (currentUser) {
                            newSplits[currentUser.uid] = equalShare;
                          }
                          
                          selectedPartners.forEach(partnerId => {
                            newSplits[partnerId] = equalShare;
                          });
                          
                          setTempSplits(newSplits);
                        }}
                        className="mt-1 text-blue-600 hover:text-blue-800 underline text-xs"
                      >
                        Distribuir igualmente
                      </button>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={closeAddExpenseModal}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#FF5A5F] text-white rounded-md hover:bg-[#E54A4F] focus:outline-none focus:ring-2 focus:ring-[#FF5A5F]"
                  disabled={
                    !newExpense.description || 
                    !newExpense.amount || 
                    !newExpense.category || 
                    !newExpense.date ||
                    (selectedPartners.length > 0 && Math.abs(Object.values(tempSplits).reduce((sum, val) => sum + val, 0) - 100) > 0.01)
                  }
                >
                  Adicionar Despesa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
} 