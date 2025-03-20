'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { collection, addDoc, query, where, onSnapshot, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// Interface para as despesas
interface Expense {
  id: string;
  description: string;
  amount: number;
  paidBy: string;
  date: Date;
  category: string;
  split: number; // Porcentagem paga pelo parceiro (0-100)
}

export default function Dashboard() {
  const { currentUser, logout, loading } = useAuth();
  const router = useRouter();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [newExpense, setNewExpense] = useState<Omit<Expense, 'id'>>({
    description: '',
    amount: 0,
    paidBy: '',
    date: new Date(),
    category: 'Alimentação',
    split: 50
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<string | null>(null);

  // Redirecionar se o usuário não estiver logado
  useEffect(() => {
    if (!loading && !currentUser) {
      router.push('/login');
    }
  }, [currentUser, loading, router]);

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
          date: data.date.toDate(),
          category: data.category,
          split: data.split
        });
      });
      setExpenses(expensesData);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Adicionar nova despesa
  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentUser) return;

    try {
      if (editingExpense) {
        // Atualizar despesa existente
        await updateDoc(doc(db, 'expenses', editingExpense), {
          description: newExpense.description,
          amount: newExpense.amount,
          paidBy: newExpense.paidBy,
          date: newExpense.date,
          category: newExpense.category,
          split: newExpense.split,
          updatedAt: new Date()
        });
        setEditingExpense(null);
      } else {
        // Adicionar nova despesa
        await addDoc(collection(db, 'expenses'), {
          ...newExpense,
          userId: currentUser.uid,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
      
      // Limpar formulário
      setNewExpense({
        description: '',
        amount: 0,
        paidBy: '',
        date: new Date(),
        category: 'Alimentação',
        split: 50
      });
      setIsModalOpen(false);
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
      date: expense.date,
      category: expense.category,
      split: expense.split
    });
    setEditingExpense(expense.id);
    setIsModalOpen(true);
  };

  // Calcular totais
  const calculateTotals = () => {
    let totalPaid = 0;
    let userPaid = 0;
    let partnerPaid = 0;

    expenses.forEach(expense => {
      totalPaid += expense.amount;
      
      if (expense.paidBy === currentUser?.displayName) {
        userPaid += expense.amount;
        // Quanto o parceiro deve ao usuário (baseado na divisão)
        partnerPaid -= (expense.amount * expense.split / 100);
      } else {
        partnerPaid += expense.amount;
        // Quanto o usuário deve ao parceiro (baseado na divisão)
        userPaid -= (expense.amount * expense.split / 100);
      }
    });

    return { totalPaid, userPaid, partnerPaid };
  };

  const { totalPaid, userPaid, partnerPaid } = calculateTotals();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  }

  return (
    <div className="min-h-screen bg-[#F7F7F7]">
      {/* Cabeçalho */}
      <header className="bg-[#FF5A5F] text-white p-4 shadow-md">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">ContiGo</h1>
          <div className="flex items-center space-x-4">
            <span>Olá, {currentUser?.displayName}</span>
            <button 
              onClick={() => logout()}
              className="bg-white text-[#FF5A5F] px-3 py-1 rounded-md hover:bg-gray-100 transition-colors"
            >
              Sair
            </button>
          </div>
        </div>
      </header>
      
      {/* Conteúdo principal */}
      <main className="container mx-auto p-4 mt-6">
        {/* Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow-md">
            <h2 className="text-lg font-semibold text-gray-700 mb-2">Total de Despesas</h2>
            <p className="text-2xl font-bold text-[#FF5A5F]">R$ {totalPaid.toFixed(2)}</p>
          </div>
          
          <div className="bg-white p-4 rounded-lg shadow-md">
            <h2 className="text-lg font-semibold text-gray-700 mb-2">Seu Saldo</h2>
            <p className={`text-2xl font-bold ${userPaid >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              R$ {userPaid.toFixed(2)}
            </p>
          </div>
          
          <div className="bg-white p-4 rounded-lg shadow-md">
            <h2 className="text-lg font-semibold text-gray-700 mb-2">Saldo do Parceiro</h2>
            <p className={`text-2xl font-bold ${partnerPaid >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              R$ {partnerPaid.toFixed(2)}
            </p>
          </div>
        </div>
        
        {/* Botão para adicionar despesa */}
        <div className="flex justify-end mb-4">
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-[#FF5A5F] text-white px-4 py-2 rounded-md hover:bg-[#E54A4F] transition-colors"
          >
            Adicionar Despesa
          </button>
        </div>
        
        {/* Lista de despesas */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descrição</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valor</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pago por</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categoria</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Divisão</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                    Nenhuma despesa encontrada. Adicione uma despesa usando o botão acima.
                  </td>
                </tr>
              ) : (
                expenses.map((expense) => (
                  <tr key={expense.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{expense.description}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">R$ {expense.amount.toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{expense.paidBy}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {expense.date.toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{expense.category}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{expense.split}%</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleEditExpense(expense)}
                        className="text-indigo-600 hover:text-indigo-900 mr-3"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDeleteExpense(expense.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
      
      {/* Modal para adicionar/editar despesa */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="border-b px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingExpense ? 'Editar Despesa' : 'Adicionar Nova Despesa'}
              </h3>
            </div>
            
            <form onSubmit={handleAddExpense} className="p-6">
              <div className="mb-4">
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
              
              <div className="mb-4">
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
              
              <div className="mb-4">
                <label htmlFor="paidBy" className="block text-sm font-medium text-gray-700 mb-1">
                  Pago por
                </label>
                <input
                  type="text"
                  id="paidBy"
                  value={newExpense.paidBy}
                  onChange={(e) => setNewExpense({...newExpense, paidBy: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-[#FF5A5F] focus:border-[#FF5A5F]"
                  required
                />
              </div>
              
              <div className="mb-4">
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
              
              <div className="mb-4">
                <label htmlFor="split" className="block text-sm font-medium text-gray-700 mb-1">
                  Divisão (% paga pelo parceiro)
                </label>
                <input
                  type="range"
                  id="split"
                  value={newExpense.split}
                  onChange={(e) => setNewExpense({...newExpense, split: parseInt(e.target.value)})}
                  className="w-full"
                  min="0"
                  max="100"
                  step="5"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>0%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
                <p className="text-center mt-1 text-sm">
                  {newExpense.split}% pago pelo parceiro, {100 - newExpense.split}% pago por você
                </p>
              </div>
              
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingExpense(null);
                    setNewExpense({
                      description: '',
                      amount: 0,
                      paidBy: '',
                      date: new Date(),
                      category: 'Alimentação',
                      split: 50
                    });
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#FF5A5F] text-white rounded-md hover:bg-[#E54A4F] focus:outline-none focus:ring-2 focus:ring-[#FF5A5F]"
                >
                  {editingExpense ? 'Salvar Alterações' : 'Adicionar Despesa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
} 