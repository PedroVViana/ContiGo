'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/lib/AuthContext';

export default function Login() {
  const { signInWithGoogle, currentUser, loading } = useAuth();
  const router = useRouter();

  // Redirecionar se o usuário já estiver logado
  useEffect(() => {
    if (currentUser && !loading) {
      router.push('/dashboard');
    }
  }, [currentUser, loading, router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F7F7F7] p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg overflow-hidden">
        {/* Cabeçalho */}
        <div className="bg-[#FF5A5F] text-white text-center py-6">
          <h1 className="text-3xl font-bold">ContiGo</h1>
          <p className="mt-2">Gerencie suas finanças com seu parceiro</p>
        </div>
        
        {/* Formulário */}
        <div className="p-8">
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-semibold text-gray-800 mb-2">Bem-vindo</h2>
            <p className="text-gray-600">Entre com sua conta para continuar</p>
          </div>
          
          <button
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 rounded-lg py-3 px-4 text-gray-700 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-[#FF5A5F] focus:ring-opacity-50 mb-4"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.501 12.2332C22.501 11.3699 22.4296 10.7399 22.2748 10.0865H12.2153V13.9832H18.12C18.001 14.9515 17.3582 16.4099 15.9296 17.3898L15.9096 17.5203L19.0902 19.935L19.3106 19.9565C21.3343 18.1249 22.501 15.4399 22.501 12.2332Z" fill="#4285F4"/>
              <path d="M12.2152 22.5C15.1088 22.5 17.5368 21.5666 19.3105 19.9566L15.9295 17.39C15.0229 18.0083 13.8093 18.4399 12.2152 18.4399C9.37197 18.4399 6.97387 16.6083 6.11133 14.0766L5.98535 14.0871L2.68382 16.5954L2.64282 16.7132C4.40516 20.1433 8.0234 22.5 12.2152 22.5Z" fill="#34A853"/>
              <path d="M6.11122 14.0767C5.9057 13.4234 5.78345 12.7233 5.78345 12C5.78345 11.2767 5.9057 10.5767 6.09856 9.92337L6.09315 9.78423L2.75042 7.23486L2.64268 7.28667C1.91923 8.71002 1.50195 10.3083 1.50195 12C1.50195 13.6916 1.91923 15.29 2.64268 16.7133L6.11122 14.0767Z" fill="#FBBC05"/>
              <path d="M12.2152 5.55997C14.2251 5.55997 15.583 6.41164 16.3576 7.12335L19.3818 4.23C17.5264 2.53834 15.1088 1.5 12.2152 1.5C8.0234 1.5 4.40516 3.85665 2.64282 7.28662L6.09875 9.92332C6.97387 7.39166 9.37197 5.55997 12.2152 5.55997Z" fill="#EB4335"/>
            </svg>
            Entrar com Google
          </button>
          
          <div className="text-center mt-8 text-sm text-gray-600">
            <p>Ao fazer login, você concorda com nossos</p>
            <p className="mt-1">
              <a href="#" className="text-[#FF5A5F] hover:underline">Termos de Serviço</a>
              {" e "}
              <a href="#" className="text-[#FF5A5F] hover:underline">Política de Privacidade</a>
            </p>
          </div>
        </div>
      </div>
      
      <div className="mt-8 text-center text-gray-500 text-sm">
        <p>© 2024 ContiGo. Todos os direitos reservados.</p>
      </div>
    </div>
  );
} 