'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

// 定义座位信息的数据结构
interface SeatingInfo {
  guestName: string;
  tableName: string;
}

export default function CheckInPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const [guestNameInput, setGuestNameInput] = useState('');
  // 状态从单个对象变为数组，用于存储所有匹配结果
  const [foundGuests, setFoundGuests] = useState<SeatingInfo[]>([]);
  // 用于存储用户最终选择的结果
  const [selectedGuest, setSelectedGuest] = useState<SeatingInfo | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [allSeatingData, setAllSeatingData] = useState<SeatingInfo[]>([]);

  // 在组件加载时从 API 获取数据
  useEffect(() => {
    const fetchSeatingData = async () => {
      setIsDataLoading(true);
      try {
        const response = await fetch(`/api/check-in/${projectId}`);
        if (!response.ok) {
          throw new Error('无法加载活动信息，请检查链接是否正确。');
        }
        const data: SeatingInfo[] = await response.json();
        setAllSeatingData(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsDataLoading(false);
      }
    };

    if (projectId) {
        fetchSeatingData();
    }
  }, [projectId]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestNameInput.trim()) {
      setError('请输入您的姓名。');
      return;
    }
    setError('');
    setFoundGuests([]);
    setSelectedGuest(null);
    setIsLoading(true);

    const formattedInput = guestNameInput.toLowerCase().replace(/\s/g, '');

    // 使用 .filter() 来获取所有匹配的宾客
    const matchingGuests = allSeatingData.filter(guest => 
      guest.guestName.toLowerCase().replace(/\s/g, '').includes(formattedInput)
    );

    setTimeout(() => {
      if (matchingGuests.length === 1) {
        // 如果只有一个匹配项，直接显示结果
        setSelectedGuest(matchingGuests[0]);
      } else if (matchingGuests.length > 1) {
        // 如果有多个匹配项，让用户选择
        setFoundGuests(matchingGuests);
      } else {
        setError('未找到您的名字，请确认输入或联系现场工作人员。');
      }
      setIsLoading(false);
    }, 500);
  };
  
  // 当用户从多选列表点击一个名字时
  const handleGuestSelection = (guest: SeatingInfo) => {
    setSelectedGuest(guest);
    setFoundGuests([]); // 清空选择列表
  };

  if (isDataLoading) {
    return (
      <div className="bg-gray-900 text-white min-h-screen flex flex-col items-center justify-center p-4 font-sans">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-blue-500"></div>
        <p className="mt-4 text-gray-400">正在加载活动信息...</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 text-white min-h-screen flex flex-col items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md text-center">
        <h1 className="text-4xl font-bold mb-2">🎉 欢迎光临 🎉</h1>
        <p className="text-gray-400 mb-8 text-lg">请输入您的姓名查找座位</p>
        
        <div className="bg-gray-800 p-8 rounded-2xl shadow-2xl border border-gray-700">
          <form onSubmit={handleSearch}>
            <input
              type="text"
              value={guestNameInput}
              onChange={(e) => setGuestNameInput(e.target.value)}
              placeholder="可输入部分姓名进行模糊搜索"
              className="w-full px-4 py-3 bg-gray-700 text-white border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200"
              required
            />
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-4 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white font-bold rounded-lg hover:opacity-90 transition-opacity duration-200 disabled:from-gray-600 disabled:to-gray-500 disabled:cursor-not-allowed"
            >
              {isLoading ? '正在查询...' : '查询我的座位'}
            </button>
          </form>

          {error && (
            <div className="mt-6 p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg animate-fadeIn">
              {error}
            </div>
          )}

          {/* 当有多个匹配结果时，显示选择列表 */}
          {foundGuests.length > 0 && (
            <div className="mt-6 p-4 bg-gray-700/50 border border-gray-600 rounded-lg animate-fadeIn">
                <p className="text-lg text-white mb-4">请问您是哪一位？</p>
                <div className="space-y-2">
                    {foundGuests.map(guest => (
                        <button
                            key={guest.guestName}
                            onClick={() => handleGuestSelection(guest)}
                            className="w-full text-left p-3 bg-blue-600/50 hover:bg-blue-600 rounded-lg transition-colors duration-200"
                        >
                            {guest.guestName}
                        </button>
                    ))}
                </div>
            </div>
          )}

          {/* 当有最终选定结果时，显示座位信息 */}
          {selectedGuest && (
            <div className="mt-6 p-6 bg-green-500/10 border border-green-500/30 text-white rounded-lg animate-fadeIn">
              <p className="text-xl">
                您好, <span className="font-bold text-green-300">{selectedGuest.guestName}</span>！
              </p>
              <p className="text-2xl mt-2">
                您的座位在: <span className="font-extrabold text-3xl text-yellow-300">{selectedGuest.tableName}</span>
              </p>
            </div>
          )}
        </div>

        <p className="text-xs text-gray-600 mt-8">
          由 SmartSeat 提供技术支持
        </p>
      </div>
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
}