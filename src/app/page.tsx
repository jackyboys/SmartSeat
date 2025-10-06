import AuthForm from '@/components/AuthForm';
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export default async function HomePage() {
  const supabase = await createClient();

  const { data } = await supabase.auth.getUser();
  if (data?.user) {
    redirect('/dashboard');
  }

  return (
    <div className="bg-gray-900 text-white min-h-screen flex flex-col">
      
      <header className="border-b border-gray-700">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold">SmartSeat.ai</h1>
        </div>
      </header>

      <main className="flex-grow flex flex-col items-center justify-center text-center px-4">
        
        <div className='mb-12'>
            <h2 className="text-5xl font-extrabold mb-4">一键生成智能座位图 ✨</h2>
            <p className="text-gray-400 text-lg">从繁琐的名单到清晰的座位安排，只需一步。</p>
        </div>

        {/* 这里是我们替换的核心部分，使用了新的登录/注册组件 */}
        <AuthForm />

        <section className="py-16 w-full max-w-4xl mt-12">
           <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 bg-gray-800 rounded-lg">
              <h3 className="text-lg font-semibold">✅ 0配置上手</h3>
              <p className="text-gray-400 mt-2">无需任何设计经验，上传名单即可开始。</p>
            </div>
            <div className="p-6 bg-gray-800 rounded-lg">
              <h3 className="text-lg font-semibold">✅ AI智能排座</h3>
              <p className="text-gray-400 mt-2">AI自动解析人物关系，智能分配座位。</p>
            </div>
            <div className="p-6 bg-gray-800 rounded-lg">
              <h3 className="text-lg font-semibold">✅ 导出PDF</h3>
              <p className="text-gray-400 mt-2">轻松导出高清座位图，方便打印与分享。</p>
            </div>
          </div>
        </section>

      </main>

      <footer className="border-t border-gray-700 py-6">
        <div className="container mx-auto px-6 text-center text-gray-500">
          <p>&copy; 2025 SmartSeat.ai | 联系我们 | 隐私政策 | 定价计划</p>
        </div>
      </footer>

    </div>
  );
}

