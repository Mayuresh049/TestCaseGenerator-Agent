import React, { useState, useEffect, useRef } from 'react';
import { Settings, User, Sparkles, Key, Zap, Layers, ArrowRight, CheckCircle } from 'lucide-react';
import ExcelJS from 'exceljs';

const App = () => {
  const [activeTab, setActiveTab] = useState('chat');
  const [appMode, setAppMode] = useState('test-gen'); // 'test-gen' or 'general'
  const [apiKey, setApiKey] = useState(localStorage.getItem('groq_api_key') || '');
  const [targetUrl, setTargetUrl] = useState(localStorage.getItem('target_url') || '');
  const [urlMode, setUrlMode] = useState(localStorage.getItem('url_mode') === 'true');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [testCases, setTestCases] = useState([]);
  const [showDownloadPrompt, setShowDownloadPrompt] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, activeTab, showDownloadPrompt]);

  const saveSettings = () => {
    localStorage.setItem('groq_api_key', apiKey);
    localStorage.setItem('target_url', targetUrl);
    localStorage.setItem('url_mode', urlMode);
    alert('Success: System parameters updated.');
  };

  const downloadExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Test Strategy');

    // 1. Executive Header
    sheet.mergeCells('A1:F1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'TESTGEN PRO | TEST STRATEGY DOCUMENT';
    titleCell.font = { name: 'Arial Black', size: 16, color: { argb: 'FFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1A73E8' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getRow(1).height = 40;

    sheet.mergeCells('A2:F2');
    const metaCell = sheet.getCell('A2');
    metaCell.value = `Generated: ${new Date().toLocaleString()} | Agent: TestGen Pro Premium | Scope: ${targetUrl || 'Internal Environment'}`;
    metaCell.font = { size: 10, italic: true, color: { argb: '666666' } };
    metaCell.alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getRow(2).height = 25;

    // 2. Column Configuration
    const HEADER_START_ROW = 4;
    sheet.columns = [
      { header: 'Case ID', key: 'id', width: 15 },
      { header: 'Requirement / Scenario', key: 'description', width: 45 },
      { header: 'Execution Steps', key: 'steps', width: 70 },
      { header: 'Expected Result', key: 'expected', width: 50 },
      { header: 'Actual Result', key: 'actual', width: 30 },
      { header: 'Status', key: 'status', width: 15 }
    ];

    // 3. Style Headers (Row 4)
    const headerRow = sheet.getRow(HEADER_START_ROW);
    headerRow.values = ['Case ID', 'Requirement / Scenario', 'Execution Steps', 'Expected Result', 'Actual Result', 'Status'];
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '34A853' } }; // Use Google Green for headers
      cell.font = { bold: true, color: { argb: 'FFFFFF' }, size: 11 };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });
    headerRow.height = 30;

    // 4. Add Data with Styling (Zebra Stripes & Dropdowns)
    testCases.forEach((tc, index) => {
      const row = sheet.addRow({
        id: tc.id,
        description: tc.description,
        steps: tc.steps,
        expected: tc.expected_result || tc.expected,
        actual: '',
        status: 'PENDING'
      });

      const isEven = index % 2 === 0;
      row.eachCell((cell, colNumber) => {
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        cell.alignment = { wrapText: true, vertical: 'top', padding: { top: 5, bottom: 5, left: 5, right: 5 } };

        if (!isEven) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8F9FA' } };
        }

        if (colNumber === 6) {
          cell.dataValidation = {
            type: 'list',
            allowBlank: true,
            formulae: ['"PASS,FAIL,BLOCKED,PENDING"']
          };
          cell.font = { bold: true };
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        }
      });
    });

    // 5. Final Polish: Auto-filter & Frozen Panes
    sheet.autoFilter = `A${HEADER_START_ROW}:F${HEADER_START_ROW}`;
    sheet.views = [{ state: 'frozen', ySplit: HEADER_START_ROW }];

    const buffer = await workbook.xlsx.writeBuffer();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([buffer]));
    a.download = `TestGen_Report_${new Date().getTime()}.xlsx`;
    a.click();
    setShowDownloadPrompt(false);
  };

  const handleSend = async (val) => {
    const text = (val || input).trim();
    if (!text || isLoading) return;
    if (!apiKey) { alert('Configuration needed: Please add your API Key in Settings.'); setActiveTab('settings'); return; }

    setMessages(prev => [...prev, { role: 'user', text }]);
    setInput('');
    setIsLoading(true);
    setShowDownloadPrompt(false);

    const prompt = appMode === 'test-gen' ? `
            You are TestGen Pro (Test Gen Mode), a professional and friendly AI QA Assistant.
            User Input: "${text}"
            ${urlMode ? `Target Site Context: ${targetUrl}` : ''}

            Instructions:
            - If the user is just greeting you (Hi, Hey, Hello), respond in a warm, human-like way without generating test cases.
            - If the user asks for test cases or describes a feature, generate them in a valid JSON array block: [ { "id": "TC001", "description": "...", "steps": "...", "expected_result": "..." } ].
            - Include a brief, helpful text response alongside any JSON you generate.
            - If the user asks a general question about QA or testing, answer it naturally.
        ` : `
            You are TestGen Pro (General Mode), an intelligent and versatile AI Assistant.
            User Input: "${text}"

            Instructions:
            - Answer any general questions the user has.
            - Provide updates on **Global News** and **AI Innovations** if asked.
            - Respond in a friendly, conversational, and helpful manner.
            - **DO NOT** generate test cases or structured JSON in this mode.
            - Use your internal knowledge base to provide recent AI and tech news.
        `;

    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.6
        })
      });
      const d = await res.json();
      const content = d.choices[0].message.content;
      const jsonMatch = content.match(/\[.*\]/s);

      if (jsonMatch) {
        try {
          const json = JSON.parse(jsonMatch[0]);
          const textPart = content.replace(jsonMatch[0], '').trim();
          setTestCases(prev => [...prev, ...json]);
          setMessages(prev => [...prev, {
            role: 'assistant',
            isTable: true,
            data: json,
            text: textPart || `✅ I've analyzed your requirements and designed ${json.length} test scenarios.`
          }]);
          setShowDownloadPrompt(true);
        } catch (parseError) {
          setMessages(prev => [...prev, { role: 'assistant', text: content }]);
        }
      } else {
        setMessages(prev => [...prev, { role: 'assistant', text: content }]);
      }
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Connection error. Please verify your API Key in Settings.' }]);
    } finally { setIsLoading(false); }
  };

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden">
      {/* Header */}
      <header className="flex justify-between items-center px-10 py-6 border-b border-gray-100 sticky top-0 bg-white z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-100">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-google font-bold color-branding tracking-tight">TestGen Pro</span>
            <div className="flex p-1 bg-gray-100/80 rounded-xl mt-1.5 w-fit border border-gray-200/50 shadow-inner backdrop-blur-sm">
              <button
                onClick={() => setAppMode('test-gen')}
                className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all duration-300 rounded-lg ${appMode === 'test-gen' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 ring-1 ring-indigo-500/50' : 'text-gray-400 hover:text-gray-600'}`}
              >
                Test Gen
              </button>
              <button
                onClick={() => setAppMode('general')}
                className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all duration-300 rounded-lg ${appMode === 'general' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 ring-1 ring-indigo-500/50' : 'text-gray-400 hover:text-gray-600'}`}
              >
                General Mode
              </button>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-12">
          <button
            onClick={() => setActiveTab('chat')}
            className={`text-[14px] font-bold transition-all tracking-tight uppercase ${activeTab === 'chat' ? 'text-indigo-600 border-b-2 border-indigo-600 pb-1' : 'text-gray-400 hover:text-black'}`}
          >
            Workspace
          </button>
          <button
            onClick={() => setActiveTab('guide')}
            className={`text-[14px] font-bold transition-all tracking-tight uppercase ${activeTab === 'guide' ? 'text-indigo-600 border-b-2 border-indigo-600 pb-1' : 'text-gray-400 hover:text-black'}`}
          >
            Platform Guide
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`group p-3 rounded-xl transition-all ${activeTab === 'settings' ? 'bg-indigo-50 text-indigo-600' : 'hover:bg-gray-50 text-gray-300'}`}
          >
            <Settings className={`w-6 h-6 transition-colors ${activeTab === 'settings' ? 'text-indigo-600' : 'group-hover:text-black'}`} />
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col overflow-hidden relative">
        {activeTab === 'chat' ? (
          <div className="flex-1 flex flex-col relative overflow-hidden">
            {messages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center px-4 animate-fadeIn">
                <div className="text-center mb-16">
                  <h2 className="text-6xl font-google font-bold text-[#1f1f1f] mb-4">Hello!</h2>
                  <h3 className="text-4xl font-google text-gray-200">
                    {appMode === 'test-gen' ? 'Where should we start testing?' : 'Ask me anything about AI or Tech.'}
                  </h3>
                </div>
                <div className="w-full max-w-3xl flex flex-wrap justify-center gap-4">
                  {appMode === 'test-gen' ? [
                    { label: 'Cloud Login Flow', icon: '☁️' },
                    { label: 'Secure Payment', icon: '💳' },
                    { label: 'Data Export Logic', icon: '📊' },
                    { label: 'REST API Specs', icon: '⚡' }
                  ].map(s => (
                    <button key={s.label} onClick={() => handleSend(s.label)} className="suggestion-btn flex items-center gap-2 px-5 py-2.5 rounded-full border border-gray-100 text-[13px] font-medium text-gray-500 hover:bg-gray-50 hover:border-gray-200 hover:text-gray-900 transition-all">
                      <span>{s.icon}</span> {s.label}
                    </button>
                  )) : [
                    { label: 'Latest AI News', icon: '📰' },
                    { label: 'Upcoming Innovations', icon: '🚀' },
                    { label: 'Global Tech Trends', icon: '🌍' },
                    { label: 'AI in 2024', icon: '✨' }
                  ].map(s => (
                    <button key={s.label} onClick={() => handleSend(s.label)} className="suggestion-btn flex items-center gap-2 px-5 py-2.5 rounded-full border border-gray-100 text-[13px] font-medium text-gray-500 hover:bg-gray-50 hover:border-gray-200 hover:text-gray-900 transition-all">
                      <span>{s.icon}</span> {s.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto px-6 py-12 custom-scrollbar scroll-smooth relative" ref={scrollRef}>
                <div className="max-w-4xl mx-auto space-y-16 pb-32">
                  {messages.map((m, i) => (
                    <div key={i} className="animate-fadeIn">
                      <div className="flex items-start gap-6">
                        <div className={`w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center shadow-sm ${m.role === 'user' ? 'bg-gray-100 text-gray-400' : 'bg-gradient-to-tr from-blue-500 via-purple-500 to-pink-500 text-white shadow-indigo-100'}`}>
                          {m.role === 'user' ? <User className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 pt-1.5 min-w-0">
                          <p className={`text-[15px] leading-relaxed ${m.role === 'user' ? 'font-bold text-gray-900' : 'text-gray-700'}`}>{m.text}</p>
                          {m.isTable && (
                            <div className="mt-8 overflow-hidden rounded-[2rem] border border-gray-100 shadow-xl bg-white">
                              <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50/80 text-gray-400 font-bold uppercase text-[9px] tracking-[0.2em] border-b border-gray-50">
                                  <tr><th className="px-8 py-5">Scenario ID</th><th className="px-8 py-5">Validation Target</th><th className="px-8 py-5">Expected Outcome</th></tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                  {m.data.map((tc, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                                      <td className="px-8 py-5 font-bold text-indigo-600">{tc.id}</td>
                                      <td className="px-8 py-5 text-gray-800 font-medium">{tc.description}</td>
                                      <td className="px-8 py-5 text-gray-500 italic leading-snug">{tc.expected_result || tc.expected}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex items-center gap-6 py-4">
                      <div className="w-10 h-10 rounded-2xl bg-gray-50 flex items-center justify-center shadow-sm"><div className="spinner-ring"></div></div>
                      <span className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.3em] animate-pulse">Thinking...</span>
                    </div>
                  )}
                  {showDownloadPrompt && (
                    <div className="flex justify-center py-10 animate-fadeIn">
                      <div className="bg-white border border-gray-100 p-12 rounded-[3rem] text-center max-w-md shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1.5 bg-indigo-500"></div>
                        <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-sm">
                          <CheckCircle className="w-8 h-8 text-indigo-600" />
                        </div>
                        <h4 className="text-3xl font-black text-gray-900 mb-4 tracking-tight italic uppercase">Suite Generation Complete</h4>
                        <p className="text-gray-500 text-sm mb-10 leading-relaxed font-medium">Your enterprise-grade test strategy is fully validated and ready for documentation. Export now to download the styled workbook.</p>
                        <div className="flex flex-col gap-4">
                          <button onClick={downloadExcel} className="w-full btn-primary py-5 rounded-2xl font-bold text-[15px] text-white shadow-xl shadow-indigo-100 active:scale-95 transition-transform">Download Excel Report</button>
                          <button onClick={() => setShowDownloadPrompt(false)} className="w-full py-4 text-gray-400 text-[11px] font-bold uppercase tracking-[0.2em] hover:text-black transition-colors">Dismiss Workspace</button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="px-6 pb-12 pt-4 bg-white/90 backdrop-blur-lg border-t border-gray-50/50 z-20">
              <div className="max-w-3xl mx-auto relative group">
                <div className="flex items-center bg-[#f0f4f9] rounded-[28px] px-7 py-5 transition-all duration-300 focus-within:bg-white focus-within:shadow-2xl focus-within:ring-1 focus-within:ring-gray-200 border border-transparent focus-within:border-gray-100">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Describe a feature or paste a requirement..."
                    className="flex-1 bg-transparent border-none focus:ring-0 focus:outline-none text-gray-800 text-[16px] font-medium placeholder-gray-400"
                    disabled={isLoading}
                  />
                  <button
                    onClick={() => handleSend()}
                    className={`p-2.5 rounded-full transition-all flex items-center justify-center ${input.trim() ? 'bg-indigo-600 text-white shadow-lg scale-110' : 'text-gray-300'}`}
                    disabled={isLoading}
                  >
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'settings' ? (
          <div className="flex-1 overflow-y-auto px-6 py-16 animate-fadeIn bg-gray-50/20">
            <div className="max-w-xl mx-auto bg-white p-12 rounded-[3.5rem] shadow-2xl shadow-gray-100 border border-gray-100">
              <h3 className="text-3xl font-black text-gray-900 mb-10 italic">Core Environment</h3>

              <div className="space-y-12">
                <div className="flex items-center justify-between p-6 bg-gray-50 rounded-3xl border border-gray-100">
                  <div>
                    <p className="font-bold text-gray-800">Advanced Site Context</p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Enhance generation with URL specific locators</p>
                  </div>
                  <label className="switch">
                    <input type="checkbox" checked={urlMode} onChange={(e) => setUrlMode(e.target.checked)} />
                    <span className="slider"></span>
                  </label>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400 ml-2">Secure LLM Key</label>
                  <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} className="w-full bg-[#f0f4f9] rounded-[1.5rem] px-7 py-5 border-none focus:ring-2 focus:ring-indigo-600 focus:bg-white transition-all shadow-inner font-mono text-sm" placeholder="••••••••••••••••" />
                </div>

                {urlMode && (
                  <div className="space-y-4 animate-fadeIn">
                    <label className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400 ml-2">SUT Endpoint (URL)</label>
                    <input type="text" value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)} className="w-full bg-[#f0f4f9] rounded-[1.5rem] px-7 py-5 border-none focus:ring-2 focus:ring-indigo-600 focus:bg-white transition-all shadow-inner text-sm" placeholder="https://app.qa-server.com" />
                  </div>
                )}

                <button onClick={saveSettings} className="w-full btn-primary py-5 rounded-[1.5rem] font-bold uppercase tracking-[0.2em] text-[11px] text-white">Sync Local Machine</button>
                <button onClick={() => setActiveTab('chat')} className="w-full text-indigo-600 font-black py-4 text-[10px] uppercase tracking-widest text-center">Return to Interface</button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-6 py-20 animate-fadeIn bg-[#fdfdfd]">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-20 animate-fadeIn">
                <h3 className="text-5xl font-google font-bold mb-6 italic tracking-tighter">Your QA Journey</h3>
                <p className="text-gray-400 font-medium">Design industry-grade test repositories in three intuitive steps.</p>
              </div>

              <div className="grid md:grid-cols-3 gap-10">
                <div className="guide-card-premium p-8 rounded-[2rem] border border-gray-50 bg-[#f8f9fa] shadow-sm hover:shadow-xl hover:bg-white transition-all duration-500">
                  <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mb-10 shadow-sm border border-indigo-100">
                    <Key className="w-7 h-7 text-indigo-600" />
                  </div>
                  <h4 className="text-xl font-black mb-4 uppercase tracking-tighter text-gray-900 italic">01. Connect</h4>
                  <p className="text-gray-400 text-[14px] leading-relaxed font-medium">Inject your secure LLM key into <b>Settings</b>. This empowers the core reasoning engine to understand complex features.</p>
                </div>

                <div className="guide-card-premium p-8 rounded-[2rem] border border-gray-50 bg-[#f8f9fa] shadow-sm hover:shadow-xl hover:bg-white transition-all duration-500">
                  <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mb-10 shadow-sm border border-indigo-100">
                    <Zap className="w-7 h-7 text-indigo-600" />
                  </div>
                  <h4 className="text-xl font-black mb-4 uppercase tracking-tighter text-gray-900 italic">02. Describe</h4>
                  <p className="text-gray-400 text-[14px] leading-relaxed font-medium">Converse with the agent. State your target feature or paste a Jira ticket. Logic, edge cases, and failure paths are analyzed instantly.</p>
                </div>

                <div className="guide-card-premium p-8 rounded-[2rem] border border-gray-50 bg-[#f8f9fa] shadow-sm hover:shadow-xl hover:bg-white transition-all duration-500">
                  <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mb-10 shadow-sm border border-indigo-100">
                    <Layers className="w-7 h-7 text-indigo-600" />
                  </div>
                  <h4 className="text-xl font-black mb-4 uppercase tracking-tighter text-gray-900 italic">03. Validate</h4>
                  <p className="text-gray-400 text-[14px] leading-relaxed font-medium">Confirm the design in chat and export a professional-grade Excel document, complete with styling and borders.</p>
                </div>
              </div>

              <div className="mt-24 text-center">
                <button onClick={() => setActiveTab('chat')} className="btn-primary px-16 py-6 rounded-3xl font-black uppercase tracking-[0.3em] text-[12px] shadow-2xl active:scale-95 text-white">Initiate Workspace</button>
              </div>
            </div>
          </div>
        )
        }
      </main >

      <footer className="bg-white py-5 text-center text-[8px] font-black uppercase tracking-[0.6em] text-gray-200">
        TestGen Pro &bull; Advanced Quality Agent &bull; 2024
      </footer>
    </div >
  );
};

export default App;
