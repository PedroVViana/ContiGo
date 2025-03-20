'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Expense, ExpenseSplit } from '@/lib/ExpenseModel';

export default function DespesaDetalhes() {
  const params = useParams();
  const id = params?.id as string;
  const { currentUser, loading } = useAuth();
  const router = useRouter();
  const [expense, setExpense] = useState<Expense | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [tempSplits, setTempSplits] = useState<{[key: string]: number}>({});
  const [splitTotal, setSplitTotal] = useState(0);

  // Redirecionar se o usuário não estiver logado
  useEffect(() => {
    if (!loading && !currentUser) {
      router.push('/login');
    }
  }, [currentUser, loading, router]);

  // Carregar despesa do Firestore
  useEffect(() => {
    if (!currentUser || !id) return;

    const fetchExpense = async () => {
      try {
        setIsLoading(true);
        const docRef = doc(db, 'expenses', id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          // Garantir que cada split tenha a propriedade 'paid'
          const normalizedSplits = (data.splits || []).map((split: ExpenseSplit) => ({
            ...split,
            paid: split.paid === undefined ? false : split.paid
          }));
          setExpense({
            id: docSnap.id,
            description: data.description,
            amount: data.amount,
            paidBy: data.paidBy,
            paidById: data.paidById,
            date: data.date.toDate(),
            category: data.category,
            splits: normalizedSplits,
            userId: data.userId,
            status: data.status || 'pendente',
            createdAt: data.createdAt?.toDate(),
            updatedAt: data.updatedAt?.toDate()
          });
        } else {
          setError('Despesa não encontrada');
        }
      } catch (err) {
        console.error('Erro ao carregar despesa:', err);
        setError('Erro ao carregar despesa. Tente novamente.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchExpense();
  }, [currentUser, id]);

  // Inicializar tempSplits quando expense é carregado
  useEffect(() => {
    if (expense) {
      const splitValues: {[key: string]: number} = {};
      
      // Inicializar com as porcentagens de todos os participantes, incluindo o usuário
      expense.splits.forEach(split => {
        splitValues[split.partnerId] = split.percentage;
      });
      
      setTempSplits(splitValues);
      
      // Calcular total das porcentagens (exceto a do usuário)
      const partnersTotal = expense.splits
        .filter(s => s.partnerId !== currentUser?.uid)
        .reduce((sum, s) => sum + s.percentage, 0);
      
      setSplitTotal(partnersTotal);
    }
  }, [expense, currentUser]);

  // Recalcular o total quando as divisões temporárias mudarem
  useEffect(() => {
    // Calcular apenas a soma das porcentagens dos parceiros (excluindo o usuário)
    const partnersTotal = Object.entries(tempSplits)
      .filter(([key]) => key !== (currentUser?.uid || ''))
      .reduce((sum, [_, value]) => sum + value, 0);
    
    setSplitTotal(partnersTotal);
  }, [tempSplits, currentUser]);

  // Calcular totais da despesa
  const calculateTotals = () => {
    if (!expense) return { userTotal: 0, partnerTotals: [] };
    
    const amount = expense.amount;
    
    // Calcular parte do usuário
    const userSplit = expense.splits.find(split => split.partnerId === currentUser?.uid);
    const userPercentage = userSplit?.percentage || 0;
    const userTotal = (amount * userPercentage / 100);
    
    // Calcular partes dos parceiros
    const partnerTotals = expense.splits
      .filter(split => split.partnerId !== currentUser?.uid)
      .map(split => {
        const partnerAmount = (amount * split.percentage / 100);
        return {
          partnerId: split.partnerId,
          partnerName: split.partnerName,
          percentage: split.percentage,
          amount: partnerAmount,
          status: split.paid ? 'pagou' : 'deve'
        };
      });
    
    return { userTotal, partnerTotals };
  };

  const { userTotal, partnerTotals } = calculateTotals();

  // Atualizar a porcentagem de um parceiro
  const updatePartnerPercentage = (partnerId: string, percentage: number) => {
    setTempSplits({...tempSplits, [partnerId]: percentage});
  };

  // Preparar splits antes de salvar
  const prepareSplitsForSave = () => {
    if (!expense) return [];
    
    const splits: ExpenseSplit[] = [];
    
    // Adicionar todos os participantes com suas porcentagens definidas
    expense.splits.forEach(split => {
      splits.push({
        partnerId: split.partnerId,
        partnerName: split.partnerName,
        percentage: tempSplits[split.partnerId] || 0,
        paid: split.paid || false
      });
    });
    
    return splits;
  };

  // Salvar as alterações nas porcentagens
  const savePercentageChanges = async () => {
    if (!expense || !currentUser) return;
    
    // Verificar se a soma das porcentagens é 100%
    const totalPercentage = Object.values(tempSplits).reduce((sum, value) => sum + value, 0);
    
    if (Math.abs(totalPercentage - 100) > 0.01) { // Pequena margem para erros de arredondamento
      alert('A soma das porcentagens deve ser exatamente 100%');
      return;
    }
    
    try {
      const splits = prepareSplitsForSave();
      
      await updateDoc(doc(db, 'expenses', expense.id as string), {
        splits: splits,
        updatedAt: new Date()
      });
      
      // Atualizar estado local
      setExpense({
        ...expense,
        splits: splits,
        updatedAt: new Date()
      });
      
      // Fechar o modal de forma controlada
      closeEditModal();
    } catch (error) {
      console.error('Erro ao atualizar porcentagens:', error);
      alert('Erro ao atualizar as porcentagens. Tente novamente.');
    }
  };

  // Função específica para fechar o modal sem efeitos colaterais
  const closeEditModal = () => {
    setIsEditModalOpen(false);
  };

  // Formato de data brasileiro
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('pt-BR');
  };

  // Função para voltar ao dashboard com segurança
  const navigateToDashboard = () => {
    router.push('/dashboard');
  };

  // Marcar pagamento de um participante
  const togglePaymentStatus = async (partnerId: string) => {
    if (!expense || !currentUser) return;
    
    try {
      // Encontrar o participante na lista atual
      const updatedSplits = expense.splits.map(split => {
        if (split.partnerId === partnerId) {
          // Criar um novo objeto para o split
          const newSplit = { ...split };
          
          // Inverter o status de pagamento
          newSplit.paid = !split.paid;
          
          // Se estiver marcando como pago, definir paidAt
          if (newSplit.paid) {
            newSplit.paidAt = new Date();
          } else {
            // Se estiver desmarcando, remover paidAt do Firebase
            // Isso é importante para evitar erros
            delete newSplit.paidAt;
          }
          
          return newSplit;
        }
        return split;
      });
      
      // Verificar se todos pagaram para atualizar o status da despesa
      const allPaid = updatedSplits.every(split => split.paid === true);
      const updatedStatus = allPaid ? 'concluida' : 'pendente';
      
      console.log('Splits a serem enviados:', JSON.stringify(updatedSplits));
      
      // Atualizar no Firestore
      await updateDoc(doc(db, 'expenses', expense.id as string), {
        splits: updatedSplits,
        status: updatedStatus,
        updatedAt: new Date()
      });
      
      // Atualizar estado local
      setExpense({
        ...expense,
        splits: updatedSplits,
        status: updatedStatus,
        updatedAt: new Date()
      });
      
      // Feedback visual para o usuário
      alert(updatedSplits.find(s => s.partnerId === partnerId)?.paid 
        ? 'Pagamento registrado com sucesso!' 
        : 'Status de pagamento atualizado para pendente!');
      
    } catch (error) {
      console.error('Erro detalhado ao atualizar status:', error);
      alert('Erro ao atualizar o status de pagamento. Tente novamente.');
    }
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F7F7]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF5A5F] mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando detalhes da despesa...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F7F7]">
        <div className="max-w-md w-full p-6 bg-white rounded-lg shadow-md">
          <div className="text-center">
            <div className="text-red-500 text-4xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">{error}</h2>
            <p className="text-gray-600 mb-6">
              Não foi possível carregar os detalhes desta despesa.
            </p>
            <button
              onClick={navigateToDashboard}
              className="w-full px-4 py-2 bg-[#FF5A5F] text-white rounded-md hover:bg-[#E54A4F] transition-colors"
            >
              Voltar para o Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F7F7]">
      {/* Cabeçalho */}
      <header className="bg-[#FF5A5F] text-white p-4 shadow-md">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">ContiGo</h1>
          <nav className="flex items-center space-x-6">
            <a href="/dashboard" className="hover:underline">Dashboard</a>
            <a href="/parceiros" className="hover:underline">Parceiros</a>
            <a href="/perfil" className="hover:underline">Perfil</a>
          </nav>
        </div>
      </header>
      
      {/* Conteúdo principal */}
      <main className="container mx-auto p-4 mt-6">
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Detalhes da Despesa</h2>
            <p className="text-gray-600">Visualize como esta despesa é dividida entre os participantes</p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="px-4 py-2 bg-[#FF5A5F] text-white rounded-md hover:bg-[#E54A4F] transition-colors"
            >
              Editar Porcentagens
            </button>
            <button
              onClick={navigateToDashboard}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Voltar para Dashboard
            </button>
          </div>
        </div>
        
        {expense && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Informações principais */}
            <div className="md:col-span-1">
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">Informações</h3>
                
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-500">Descrição</p>
                    <p className="font-medium">{expense.description}</p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-gray-500">Categoria</p>
                    <p className="font-medium">{expense.category}</p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-gray-500">Valor Total</p>
                    <p className="font-bold text-xl text-[#FF5A5F]">R$ {expense.amount.toFixed(2)}</p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-gray-500">Data</p>
                    <p className="font-medium">{formatDate(expense.date)}</p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-gray-500">Pago por</p>
                    <p className="font-medium">{expense.paidBy}</p>
                  </div>
                  
                  <div className="pt-2 border-t">
                    <p className="text-sm text-gray-500">Criado em</p>
                    <p className="font-medium">{expense.createdAt ? formatDate(expense.createdAt) : '-'}</p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Divisão detalhada */}
            <div className="md:col-span-2">
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">Divisão da Despesa</h3>
                
                <div className="mb-6">
                  <h4 className="font-medium text-gray-700 mb-2">Resumo da Divisão</h4>
                  <div className="bg-gray-50 p-4 rounded-md">
                    <div className="space-y-3">
                      {expense.splits.map((split, index) => (
                        <div key={index}>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-sm font-medium">
                              {split.partnerName} 
                              {split.partnerId === currentUser?.uid && ' (Você)'}
                              {split.paid && ' (Pago)'}
                            </span>
                            <span className="text-sm font-medium">{split.percentage}%</span>
                          </div>
                          <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${
                                split.partnerId === currentUser?.uid 
                                  ? 'bg-blue-500' 
                                  : split.paid 
                                    ? 'bg-green-500' 
                                    : 'bg-yellow-500'
                              }`} 
                              style={{width: `${split.percentage}%`}}
                            ></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div className="mb-6">
                  <h4 className="font-medium text-gray-700 mb-2">Valores por Pessoa</h4>
                  <div className="overflow-hidden border border-gray-200 rounded-md">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Participante</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Percentual</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valor</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {/* Linha do usuário */}
                        <tr className="bg-blue-50">
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                            {currentUser?.displayName || 'Você'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                            {expense.splits.find(s => s.partnerId === currentUser?.uid)?.percentage || 0}%
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 font-medium">
                            R$ {userTotal.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm">
                            {expense.splits.find(s => s.partnerId === currentUser?.uid)?.paid ? (
                              <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                                Pago
                              </span>
                            ) : (
                              <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                                Pendente
                              </span>
                            )}
                          </td>
                        </tr>
                        
                        {/* Linhas dos parceiros */}
                        {partnerTotals.map((partnerTotal, index) => (
                          <tr key={index} className={partnerTotal.partnerId === expense.paidById ? 'bg-green-50' : ''}>
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                              {partnerTotal.partnerName}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                              {partnerTotal.percentage}%
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 font-medium">
                              R$ {partnerTotal.amount.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm">
                              {partnerTotal.status === 'pagou' ? (
                                <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                                  Pagou
                                </span>
                              ) : (
                                <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                                  Deve
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                
                {/* Resultados */}
                <div>
                  <h4 className="font-medium text-gray-700 mb-2">Resultado</h4>
                  <div className="bg-gray-50 p-4 rounded-md">
                    {expense.paidById === currentUser?.uid ? (
                      <div>
                        <p className="font-medium">Você pagou esta despesa. Os seguintes valores devem ser reembolsados a você:</p>
                        <ul className="mt-2 space-y-1">
                          {partnerTotals
                            .filter(partner => !expense.splits.find(s => s.partnerId === partner.partnerId)?.paid)
                            .map((partnerTotal, index) => (
                              <li key={index} className="flex justify-between">
                                <span>{partnerTotal.partnerName}</span>
                                <span className="font-medium text-green-600">R$ {partnerTotal.amount.toFixed(2)}</span>
                              </li>
                            ))}
                        </ul>
                        {partnerTotals.every(partner => 
                          expense.splits.find(s => s.partnerId === partner.partnerId)?.paid
                        ) && (
                          <p className="mt-3 font-medium text-green-600">Todos os participantes já pagaram suas partes!</p>
                        )}
                      </div>
                    ) : (
                      <div>
                        <p className="font-medium">
                          <span className="font-bold">{expense.paidBy}</span> pagou esta despesa.
                        </p>
                        {!expense.splits.find(s => s.partnerId === currentUser?.uid)?.paid ? (
                          <p className="mt-2">
                            Você deve reembolsar: <span className="font-bold text-red-600">R$ {userTotal.toFixed(2)}</span>
                          </p>
                        ) : (
                          <p className="mt-2 text-green-600 font-medium">
                            Você já pagou sua parte desta despesa!
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Novo componente para visualização de status da despesa */}
        {expense && (
          <div className="mt-8 bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4 text-blue-600">Status de Pagamentos</h2>
            
            <div className="space-y-4">
              {/* Status de pagamento do usuário que criou a despesa */}
              {expense.splits.find(s => s.partnerId === currentUser?.uid) && (
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                  <div className="flex-1">
                    <div className="font-medium">{expense.splits.find(s => s.partnerId === currentUser?.uid)?.partnerName} (Você)</div>
                    <div className="text-sm text-gray-600">
                      {((expense.amount * (expense.splits.find(s => s.partnerId === currentUser?.uid)?.percentage || 0)) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} 
                      ({expense.splits.find(s => s.partnerId === currentUser?.uid)?.percentage}%)
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                      expense.splits.find(s => s.partnerId === currentUser?.uid)?.paid 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {expense.splits.find(s => s.partnerId === currentUser?.uid)?.paid ? 'Pago' : 'Pendente'}
                    </div>
                    <button
                      onClick={() => togglePaymentStatus(currentUser?.uid || '')}
                      className={`px-3 py-1 rounded-md text-sm font-medium text-white ${
                        expense.splits.find(s => s.partnerId === currentUser?.uid)?.paid 
                          ? 'bg-yellow-500 hover:bg-yellow-600' 
                          : 'bg-green-500 hover:bg-green-600'
                      }`}
                    >
                      {expense.splits.find(s => s.partnerId === currentUser?.uid)?.paid ? 'Desfazer' : 'Marcar como Pago'}
                    </button>
                  </div>
                </div>
              )}
              
              {/* Status de pagamento dos parceiros */}
              {expense.splits
                .filter(split => split.partnerId !== currentUser?.uid)
                .map(split => (
                  <div key={split.partnerId} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                    <div className="flex-1">
                      <div className="font-medium">{split.partnerName}</div>
                      <div className="text-sm text-gray-600">
                        {((expense.amount * split.percentage) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} 
                        ({split.percentage}%)
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                        split.paid 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {split.paid ? 'Pago' : 'Pendente'}
                      </div>
                      <button
                        onClick={() => togglePaymentStatus(split.partnerId)}
                        className={`px-3 py-1 rounded-md text-sm font-medium text-white ${
                          split.paid 
                            ? 'bg-yellow-500 hover:bg-yellow-600' 
                            : 'bg-green-500 hover:bg-green-600'
                        }`}
                      >
                        {split.paid ? 'Desfazer' : 'Marcar como Pago'}
                      </button>
                    </div>
                  </div>
                ))
              }
            </div>
            
            {/* Progresso geral de pagamentos */}
            <div className="mt-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">Progresso de Pagamentos</span>
                <span className="text-sm font-medium text-gray-700">
                  {expense.splits.filter(s => s.paid).length}/{expense.splits.length} pagos
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-blue-600 h-2.5 rounded-full" 
                  style={{ width: `${(expense.splits.filter(s => s.paid).length / expense.splits.length) * 100}%` }}
                ></div>
              </div>
            </div>
            
            {/* Botão para marcar a despesa como concluída se todos pagaram */}
            {expense.splits.every(s => s.paid) && expense.status !== 'concluida' && (
              <div className="mt-6">
                <button
                  onClick={async () => {
                    try {
                      await updateDoc(doc(db, 'expenses', expense.id as string), {
                        status: 'concluida',
                        updatedAt: new Date()
                      });
                      setExpense({
                        ...expense,
                        status: 'concluida',
                        updatedAt: new Date()
                      });
                      alert('Despesa marcada como concluída!');
                    } catch (error) {
                      console.error('Erro ao atualizar status da despesa:', error);
                      alert('Erro ao marcar despesa como concluída. Tente novamente.');
                    }
                  }}
                  className="w-full py-2 bg-green-500 text-white font-medium rounded-md hover:bg-green-600 transition-colors"
                >
                  Marcar Despesa como Concluída
                </button>
              </div>
            )}
          </div>
        )}
      </main>
      
      {/* Modal para editar porcentagens */}
      {isEditModalOpen && expense && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="border-b px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Editar Porcentagens
              </h3>
            </div>

            <div className="p-6">
              <div className="mb-4 p-3 bg-amber-50 rounded-lg">
                <p className="font-medium">Divisão da despesa: {expense?.description}</p>
                <p className="text-sm mt-1">Valor total: R$ {expense?.amount.toFixed(2)}</p>
              </div>
              
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-medium">Porcentagens de cada participante</h4>
                  <span className={`text-sm font-medium ${
                    Math.abs(Object.values(tempSplits).reduce((sum, val) => sum + val, 0) - 100) < 0.01 
                      ? 'text-green-500' 
                      : 'text-red-500'
                  }`}>
                    Total: {Object.values(tempSplits).reduce((sum, val) => sum + val, 0).toFixed(1)}%
                  </span>
                </div>
                
                <div className="grid grid-cols-[2fr,1fr,1fr,1fr] gap-2 mb-2 text-sm font-medium bg-gray-100 p-2 rounded">
                  <div>Participante</div>
                  <div>Porcentagem</div>
                  <div>Slider</div>
                  <div>Valor (R$)</div>
                </div>

                {/* Input do usuário */}
                {expense && currentUser && (
                  <div className="grid grid-cols-[2fr,1fr,1fr,1fr] gap-2 items-center border-b pb-2 mb-2">
                    <div className="font-medium">{currentUser.displayName || 'Você'}</div>
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
                    <div>
                      R$ {((expense.amount * (tempSplits[currentUser.uid] || 0)) / 100).toFixed(2)}
                    </div>
                  </div>
                )}

                {/* Inputs dos parceiros */}
                {expense && expense.splits
                  .filter(split => split.partnerId !== currentUser?.uid)
                  .map(split => (
                    <div key={split.partnerId} className="grid grid-cols-[2fr,1fr,1fr,1fr] gap-2 items-center border-b pb-2 mb-2">
                      <div className="font-medium">{split.partnerName}</div>
                      <div className="flex items-center">
                        <input 
                          type="number" 
                          min="0" 
                          max="100" 
                          className="w-14 p-1 border rounded"
                          value={tempSplits[split.partnerId] || 0}
                          onChange={(e) => updatePartnerPercentage(split.partnerId, Number(e.target.value))}
                        />
                        <span className="ml-1">%</span>
                      </div>
                      <div>
                        <input 
                          type="range"
                          min="0"
                          max="100"
                          className="w-full"
                          value={tempSplits[split.partnerId] || 0}
                          onChange={(e) => updatePartnerPercentage(split.partnerId, Number(e.target.value))}
                        />
                      </div>
                      <div>
                        R$ {((expense.amount * (tempSplits[split.partnerId] || 0)) / 100).toFixed(2)}
                      </div>
                    </div>
                  ))
                }
                
                <div className="mt-4 text-sm text-gray-600">
                  <p>Nota: A soma das porcentagens deve ser exatamente 100%</p>
                  <button 
                    onClick={() => {
                      if (!expense || !currentUser) return;
                      
                      // Distribuir igualmente entre todos os participantes
                      const totalParticipants = expense.splits.length;
                      const equalShare = 100 / totalParticipants;
                      
                      const newSplits = {...tempSplits};
                      expense.splits.forEach(split => {
                        newSplits[split.partnerId] = equalShare;
                      });
                      
                      setTempSplits(newSplits);
                    }}
                    className="mt-2 text-blue-600 hover:text-blue-800 underline"
                  >
                    Distribuir igualmente
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button 
                  type="button"
                  onClick={closeEditModal}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={savePercentageChanges}
                  className="px-4 py-2 bg-[#FF5A5F] text-white rounded-md hover:bg-[#E54A4F] focus:outline-none focus:ring-2 focus:ring-[#FF5A5F]"
                  disabled={Math.abs(Object.values(tempSplits).reduce((sum, val) => sum + val, 0) - 100) > 0.01}
                >
                  Salvar Alterações
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 