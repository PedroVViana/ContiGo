'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { collection, addDoc, query, where, onSnapshot, deleteDoc, doc, updateDoc, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// Interface para os parceiros
interface Partner {
  id: string;
  name: string;
  email: string;
  status: 'pendente' | 'ativo' | 'recusado';
  createdAt: Date;
}

export default function Partners() {
  const { currentUser, loading } = useAuth();
  const router = useRouter();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [newPartnerName, setNewPartnerName] = useState('');
  const [newPartnerEmail, setNewPartnerEmail] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [totalActivePartners, setTotalActivePartners] = useState(0);

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
      where('userId', '==', currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const partnersData: Partner[] = [];
      let activeCount = 0;
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const partner = {
          id: doc.id,
          name: data.name,
          email: data.email,
          status: data.status,
          createdAt: data.createdAt.toDate()
        };
        
        partnersData.push(partner);
        if (partner.status === 'ativo') {
          activeCount++;
        }
      });
      
      setPartners(partnersData);
      setTotalActivePartners(activeCount);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Adicionar novo parceiro
  const handleAddPartner = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentUser || !newPartnerEmail || !newPartnerName) return;

    try {
      await addDoc(collection(db, 'partners'), {
        userId: currentUser.uid,
        email: newPartnerEmail,
        name: newPartnerName,
        status: 'ativo', // Mudamos para ativo diretamente para simplificar
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      // Limpar formulário
      setNewPartnerName('');
      setNewPartnerEmail('');
      setIsModalOpen(false);
    } catch (error) {
      console.error('Erro ao adicionar parceiro:', error);
    }
  };

  // Excluir parceiro
  const handleDeletePartner = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este parceiro? Esta ação não afetará despesas já registradas.')) {
      try {
        await deleteDoc(doc(db, 'partners', id));
      } catch (error) {
        console.error('Erro ao excluir parceiro:', error);
      }
    }
  };

  // Atualizar status do parceiro
  const handleUpdateStatus = async (id: string, status: 'pendente' | 'ativo' | 'recusado') => {
    try {
      await updateDoc(doc(db, 'partners', id), {
        status,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Erro ao atualizar status do parceiro:', error);
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
            <a href="/dashboard" className="hover:underline">Dashboard</a>
            <a href="/parceiros" className="hover:underline font-bold">Parceiros</a>
            <a href="/perfil" className="hover:underline">Perfil</a>
          </nav>
        </div>
      </header>
      
      {/* Conteúdo principal */}
      <main className="container mx-auto p-4 mt-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Gerenciar Parceiros</h2>
            <p className="text-gray-600 mt-1">Total de parceiros ativos: {totalActivePartners}</p>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-[#FF5A5F] text-white px-4 py-2 rounded-md hover:bg-[#E54A4F] transition-colors"
          >
            Adicionar Parceiro
          </button>
        </div>
        
        {/* Lista de parceiros */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data de Adição</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {partners.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                    Nenhum parceiro encontrado. Adicione parceiros usando o botão acima.
                  </td>
                </tr>
              ) : (
                partners.map((partner) => (
                  <tr key={partner.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {partner.name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{partner.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${
                        partner.status === 'ativo' 
                          ? 'bg-green-100 text-green-800' 
                          : partner.status === 'pendente' 
                            ? 'bg-yellow-100 text-yellow-800' 
                            : 'bg-red-100 text-red-800'
                      }`}>
                        {partner.status === 'ativo' 
                          ? 'Ativo' 
                          : partner.status === 'pendente' 
                            ? 'Pendente' 
                            : 'Recusado'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {partner.createdAt.toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {partner.status !== 'ativo' && (
                        <button
                          onClick={() => handleUpdateStatus(partner.id, 'ativo')}
                          className="text-green-600 hover:text-green-900 mr-3"
                        >
                          Ativar
                        </button>
                      )}
                      {partner.status === 'ativo' && (
                        <button
                          onClick={() => handleUpdateStatus(partner.id, 'recusado')}
                          className="text-yellow-600 hover:text-yellow-900 mr-3"
                        >
                          Desativar
                        </button>
                      )}
                      <button
                        onClick={() => handleDeletePartner(partner.id)}
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
        
        {/* Informações sobre parceiros */}
        <div className="mt-8 bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">Como funcionam os parceiros no ContiGo</h3>
          <div className="space-y-4">
            <div>
              <p className="text-gray-600">
                No ContiGo, você pode adicionar múltiplos parceiros com quem divide suas despesas.
                Cada despesa pode ser dividida de forma personalizada entre você e seus parceiros.
              </p>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900">Exemplo de uso:</h4>
              <ol className="list-decimal pl-5 mt-2 text-gray-600 space-y-2">
                <li>Adicione seus parceiros aqui (família, amigos, colegas de apartamento)</li>
                <li>Ao registrar uma despesa, selecione quais parceiros participarão</li>
                <li>Defina como a despesa será dividida entre os participantes</li>
                <li>O ContiGo calculará automaticamente quanto cada um deve</li>
              </ol>
            </div>
            
            <div className="border-t pt-4">
              <p className="text-sm text-gray-500">
                Dica: Você pode ter parceiros diferentes para diferentes tipos de despesas. 
                Por exemplo, colegas de apartamento para despesas domésticas e familiares para viagens.
              </p>
            </div>
          </div>
        </div>
      </main>
      
      {/* Modal para adicionar parceiro */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="border-b px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Adicionar Novo Parceiro
              </h3>
            </div>
            
            <form onSubmit={handleAddPartner} className="p-6">
              <div className="mb-4">
                <label htmlFor="partnerName" className="block text-sm font-medium text-gray-700 mb-1">
                  Nome do Parceiro
                </label>
                <input
                  type="text"
                  id="partnerName"
                  value={newPartnerName}
                  onChange={(e) => setNewPartnerName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-[#FF5A5F] focus:border-[#FF5A5F]"
                  placeholder="Nome do parceiro"
                  required
                />
              </div>
              
              <div className="mb-4">
                <label htmlFor="partnerEmail" className="block text-sm font-medium text-gray-700 mb-1">
                  Email do Parceiro
                </label>
                <input
                  type="email"
                  id="partnerEmail"
                  value={newPartnerEmail}
                  onChange={(e) => setNewPartnerEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-[#FF5A5F] focus:border-[#FF5A5F]"
                  placeholder="email@exemplo.com"
                  required
                />
                <p className="mt-2 text-sm text-gray-500">
                  Adicione seus parceiros para dividirem despesas com você.
                </p>
              </div>
              
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setNewPartnerName('');
                    setNewPartnerEmail('');
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#FF5A5F] text-white rounded-md hover:bg-[#E54A4F] focus:outline-none focus:ring-2 focus:ring-[#FF5A5F]"
                >
                  Adicionar Parceiro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
} 