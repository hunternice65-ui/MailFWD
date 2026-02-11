
import React, { useState, useRef, useEffect } from 'react';
import { FormData, AttendanceType } from './types';
import { SignaturePad } from './components/SignaturePad';
import { generatePDF, generatePDFBlob } from './services/pdfService';
import { GoogleGenAI } from "@google/genai";

const ORGANIZER_EMAIL = 'suntareesr@nu.ac.th';

const initialData: FormData = {
  projectName: 'โครงการประชุมวิชาการภาควิชากุมารเวชศาสตร์ประจำปี 2569',
  eventDate: '2-3 กรกฎาคม 2569',
  location: 'ห้องประชุมเอกาทศรถ 9 ชั้น 3 อาคารสิรินธร โรงพยาบาลมหาวิทยาลัยนเรศวร',
  organizer: 'ภาควิชากุมารเวชศาสตร์ คณะแพทยศาสตร์ มหาวิทยาลัยนเรศวร',
  fullName: '',
  position: '',
  department: '',
  phone: '',
  email: '',
  attendanceType: '',
  feeAcknowledged: false,
  feePaid: false,
  paymentSlip: '',
  signatureData: '',
  isCertified: false,
  submissionDate: new Date().toLocaleDateString('th-TH'),
};

const App: React.FC = () => {
  const [formData, setFormData] = useState<FormData>(initialData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sendStage, setSendStage] = useState<'idle' | 'generating' | 'sending' | 'success'>('idle');
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [aiDraft, setAiDraft] = useState('');
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const [step, setStep] = useState(1);

  useEffect(() => {
    if (navigator.share && navigator.canShare) {
      setCanShare(true);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const generateFormalDraft = async () => {
    setIsGeneratingDraft(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `เขียนเนื้อหาอีเมลภาษาไทยแบบเป็นทางการ เพื่อส่งใบตอบรับเข้าร่วมโครงการ "${formData.projectName}" 
      ถึงผู้จัดงาน (${formData.organizer}) 
      จากผู้สมัครชื่อ ${formData.fullName} ตำแหน่ง ${formData.position} สังกัด ${formData.department}
      เนื้อหาต้องระบุว่าได้แนบใบตอบรับมาพร้อมนี้แล้ว และขอให้ตอบกลับเพื่อยืนยันการลงทะเบียน
      ใช้น้ำเสียงสุภาพ เป็นทางการแบบราชการ`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });
      setAiDraft(response.text || '');
    } catch (error) {
      setAiDraft(`เรียน ทีมงานผู้จัดโครงการ\n\nข้าพเจ้า ${formData.fullName} ขอส่งใบตอบรับเข้าร่วมโครงการแนบมาพร้อมกับอีเมลฉบับนี้\n\nจึงเรียนมาเพื่อโปรดพิจารณาลงทะเบียน`);
    } finally {
      setIsGeneratingDraft(false);
    }
  };

  const handleSignatureSave = (dataUrl: string) => {
    setFormData(prev => ({ ...prev, signatureData: dataUrl }));
  };

  const handleDownloadPDF = async () => {
    setIsSubmitting(true);
    await generatePDF('form-document', `แบบตอบรับ_${formData.fullName || 'โครงการ'}.pdf`);
    setIsSubmitting(false);
  };

  const processEmailSend = async (provider: 'share' | 'gmail' | 'numail' | 'outlook') => {
    setIsSubmitting(true);
    setSendStage('generating');
    
    // Create PDF First
    const blob = await generatePDFBlob('form-document');
    if (!blob) {
      setIsSubmitting(false);
      return;
    }

    const fileName = `ใบตอบรับ_${formData.fullName}.pdf`;
    const file = new File([blob], fileName, { type: 'application/pdf' });
    
    // Copy Draft to Clipboard Automatically
    if (aiDraft) {
      await navigator.clipboard.writeText(aiDraft);
    }

    setSendStage('sending');

    if (provider === 'share' && canShare) {
      try {
        await navigator.share({
          files: [file],
          title: 'แบบตอบรับเข้าร่วมโครงการ',
          text: aiDraft || `ส่งใบตอบรับของ ${formData.fullName}`,
        });
        setSendStage('success');
      } catch (e) {
        console.error(e);
        setSendStage('idle');
      }
    } else {
      // For web mailers, we download file first then redirect
      await handleDownloadPDF();
      
      const subject = encodeURIComponent(`ใบตอบรับ: ${formData.projectName} - ${formData.fullName}`);
      const body = encodeURIComponent(aiDraft || "เรียน ผู้จัดงาน...");
      
      let url = '';
      if (provider === 'gmail' || provider === 'numail') {
        url = `https://mail.google.com/mail/?view=cm&fs=1&to=${ORGANIZER_EMAIL}&su=${subject}&body=${body}`;
      } else if (provider === 'outlook') {
        url = `https://outlook.live.com/owa/?path=/mail/action/compose&to=${ORGANIZER_EMAIL}&subject=${subject}&body=${body}`;
      }
      
      window.open(url, '_blank');
      setSendStage('success');
    }
    
    setIsSubmitting(false);
  };

  const isFormValid = formData.fullName && formData.projectName && formData.attendanceType && formData.isCertified && formData.signatureData;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sarabun">
      <div className="max-w-6xl mx-auto">
        {/* Progress Stepper */}
        <div className="flex justify-center mb-8 no-print">
          <div className="flex items-center gap-4 bg-white px-6 py-3 rounded-full shadow-sm border border-slate-200">
            <div className={`flex items-center gap-2 ${step === 1 ? 'text-blue-600 font-bold' : 'text-slate-400'}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step === 1 ? 'bg-blue-600 text-white' : 'bg-slate-200'}`}>1</span>
              กรอกข้อมูล
            </div>
            <div className="w-12 h-px bg-slate-200"></div>
            <div className={`flex items-center gap-2 ${step === 2 ? 'text-blue-600 font-bold' : 'text-slate-400'}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step === 2 ? 'bg-blue-600 text-white' : 'bg-slate-200'}`}>2</span>
              ตรวจสอบและส่ง
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Form Side */}
          <div className={`no-print ${step === 2 ? 'hidden lg:block' : ''}`}>
             <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
               <div className="bg-blue-800 p-5 text-white">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    ลงทะเบียนข้อมูล
                  </h2>
               </div>
               <div className="p-6 space-y-6">
                 <section className="space-y-4">
                   <label className="block">
                     <span className="text-sm font-black text-slate-700 block mb-1">ชื่อ - นามสกุล *</span>
                     <input name="fullName" type="text" value={formData.fullName} onChange={handleInputChange} className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-bold text-black" />
                   </label>
                   <div className="grid grid-cols-2 gap-4">
                     <label className="block">
                       <span className="text-sm font-black text-slate-700 block mb-1">ตำแหน่ง</span>
                       <input name="position" type="text" value={formData.position} onChange={handleInputChange} className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl font-bold text-black" />
                     </label>
                     <label className="block">
                       <span className="text-sm font-black text-slate-700 block mb-1">หน่วยงาน</span>
                       <input name="department" type="text" value={formData.department} onChange={handleInputChange} className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl font-bold text-black" />
                     </label>
                   </div>
                 </section>

                 <section>
                   <span className="text-sm font-black text-slate-700 block mb-3">รูปแบบการเข้าร่วม</span>
                   <div className="flex gap-4">
                      {[AttendanceType.ONSITE, AttendanceType.RERUN].map(type => (
                        <label key={type} className={`flex-1 flex items-center justify-center gap-2 p-4 border-2 rounded-xl cursor-pointer transition ${formData.attendanceType === type ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold' : 'border-slate-100 text-slate-400'}`}>
                          <input type="radio" name="attendanceType" value={type} checked={formData.attendanceType === type} onChange={handleInputChange} className="hidden" />
                          {type}
                        </label>
                      ))}
                   </div>
                 </section>

                 <section>
                    <span className="text-sm font-black text-slate-700 block mb-3">ลายมือชื่ออิเล็กทรอนิกส์</span>
                    <SignaturePad onSave={handleSignatureSave} onClear={() => setFormData(p => ({...p, signatureData: ''}))} />
                    <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input type="checkbox" name="isCertified" checked={formData.isCertified} onChange={handleInputChange} className="mt-1 w-5 h-5 text-blue-600 rounded" />
                        <span className="text-xs font-bold text-slate-600">ข้าพเจ้าขอรับรองว่าข้อมูลถูกต้อง และยินยอมให้ใช้เป็นหลักฐานอิเล็กทรอนิกส์ตามกฎหมาย</span>
                      </label>
                    </div>
                 </section>

                 <button onClick={() => setStep(2)} disabled={!isFormValid} className={`w-full py-4 rounded-2xl font-black text-lg shadow-lg transition transform active:scale-95 ${isFormValid ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>
                   ตรวจสอบและส่งเอกสาร &rarr;
                 </button>
               </div>
             </div>
          </div>

          {/* Preview Side */}
          <div className={`${step === 1 ? 'hidden lg:block' : ''} space-y-6`}>
            {/* Quick Actions */}
            <div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-200 no-print flex gap-4">
               <button onClick={handleDownloadPDF} className="flex-1 flex items-center justify-center gap-2 p-4 bg-slate-100 rounded-xl font-bold text-slate-700 hover:bg-slate-200 transition">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                 โหลด PDF
               </button>
               <button onClick={() => setShowConfigModal(true)} className="flex-1 flex items-center justify-center gap-2 p-4 bg-blue-600 text-white rounded-xl font-black shadow-lg hover:bg-blue-700 transition">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" /></svg>
                 ส่งเมลทันที
               </button>
            </div>

            {/* AI Assistant */}
            <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-2xl no-print">
               <div className="flex justify-between items-center mb-3">
                 <h4 className="text-sm font-black text-indigo-900 flex items-center gap-2">✨ เนื้อหานำส่ง (โดย AI)</h4>
                 <button onClick={generateFormalDraft} disabled={isGeneratingDraft} className="text-xs bg-white px-3 py-1.5 rounded-lg border border-indigo-200 font-bold text-indigo-700 hover:bg-indigo-100 transition">
                   {isGeneratingDraft ? 'กำลังร่าง...' : 'ร่างใหม่'}
                 </button>
               </div>
               <div className="bg-white p-4 rounded-xl border border-indigo-100 text-xs text-slate-800 leading-relaxed min-h-[100px] font-medium whitespace-pre-wrap">
                 {aiDraft || "แนะนำให้กดปุ่ม 'ร่างใหม่' เพื่อเตรียมข้อความอีเมลที่เป็นทางการ"}
               </div>
            </div>

            {/* A4 Preview */}
            <div className="relative bg-slate-200 p-4 rounded-xl overflow-hidden border border-slate-300 shadow-inner">
               <div id="form-document" className="bg-white mx-auto p-[15mm] w-[210mm] min-h-[297mm] text-black border border-gray-100 flex flex-col justify-start origin-top scale-[0.3] sm:scale-[0.4] md:scale-[0.45] lg:scale-[0.5] xl:scale-[0.7] -mb-[60%] sm:-mb-[40%] md:-mb-[30%] lg:-mb-[20%] xl:-mb-[15%]">
                  <div className="text-center mb-10 border-b-2 border-black pb-5">
                    <h1 className="text-3xl font-bold mb-2">แบบตอบรับเข้าร่วมโครงการ</h1>
                    <p className="text-lg font-bold text-black uppercase tracking-widest">{formData.organizer}</p>
                  </div>
                  <div className="space-y-8 text-base">
                    <div className="grid grid-cols-[160px_1fr] gap-y-4">
                      <span className="font-bold">โครงการ:</span> <span>{formData.projectName}</span>
                      <span className="font-bold">วัน/เวลา:</span> <span>{formData.eventDate}</span>
                      <span className="font-bold">สถานที่:</span> <span>{formData.location}</span>
                    </div>
                    <div className="mt-10 p-8 border-2 border-black rounded-2xl bg-gray-50/50">
                      <h3 className="font-bold text-xl mb-6 border-b-2 border-black/10 pb-2">ข้อมูลผู้ตอบรับ</h3>
                      <div className="grid grid-cols-2 gap-y-6">
                        <p><span className="font-bold">ชื่อ-นามสกุล:</span> {formData.fullName || '................'}</p>
                        <p><span className="font-bold">ตำแหน่ง:</span> {formData.position || '................'}</p>
                        <p className="col-span-2"><span className="font-bold">สังกัด:</span> {formData.department || '................'}</p>
                        <p><span className="font-bold">รูปแบบ:</span> {formData.attendanceType || '................'}</p>
                      </div>
                    </div>
                    <div className="mt-20 ml-auto w-[300px] text-center space-y-3">
                      <p className="font-bold text-lg italic">ลงชื่อรับรองข้อมูล</p>
                      <div className="h-20 flex items-center justify-center border-b-2 border-black/20 mx-4">
                         {formData.signatureData && <img src={formData.signatureData} alt="sign" className="max-h-16" />}
                      </div>
                      <p className="font-bold text-lg">( {formData.fullName || '................'} )</p>
                      <p className="font-bold text-gray-500">ลงวันที่: {formData.submissionDate}</p>
                    </div>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modern Send Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-xl flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-2xl overflow-hidden shadow-2xl border border-white/20 animate-in fade-in zoom-in duration-300">
            <div className="p-8 border-b bg-gradient-to-r from-blue-600 to-indigo-700 text-white relative">
              <h3 className="text-2xl font-black">เลือกระบบส่งอีเมล</h3>
              <p className="opacity-80 text-sm font-bold mt-1">ส่งตรงถึง: {ORGANIZER_EMAIL}</p>
              <button onClick={() => setShowConfigModal(false)} className="absolute top-8 right-8 text-white/60 hover:text-white transition">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Method A: Mobile/App Share */}
              {canShare && (
                <button onClick={() => processEmailSend('share')} className="flex flex-col items-center gap-4 p-8 border-2 border-blue-100 bg-blue-50 rounded-[1.5rem] hover:border-blue-500 hover:scale-[1.02] transition-all group shadow-sm">
                  <div className="bg-blue-600 text-white p-5 rounded-2xl shadow-lg group-hover:bg-blue-700 transition">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                  </div>
                  <div className="text-center">
                    <h4 className="font-black text-blue-900 text-lg">แนบไฟล์อัตโนมัติ</h4>
                    <p className="text-[10px] text-blue-500 font-black uppercase mt-1 tracking-widest">แนะนำ: สำหรับมือถือ/แอปเมล</p>
                  </div>
                </button>
              )}

              {/* Method B: Gmail/NU Mail */}
              <button onClick={() => processEmailSend('numail')} className="flex flex-col items-center gap-4 p-8 border-2 border-red-100 bg-red-50 rounded-[1.5rem] hover:border-red-500 hover:scale-[1.02] transition-all group shadow-sm">
                <div className="bg-red-600 text-white p-5 rounded-2xl shadow-lg group-hover:bg-red-700 transition">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                </div>
                <div className="text-center">
                  <h4 className="font-black text-red-900 text-lg">Gmail / NU Mail</h4>
                  <p className="text-[10px] text-red-500 font-black uppercase mt-1 tracking-widest">ผ่านเว็บเบราว์เซอร์</p>
                </div>
              </button>

              {/* Method C: Outlook */}
              <button onClick={() => processEmailSend('outlook')} className="flex flex-col items-center gap-4 p-8 border-2 border-indigo-100 bg-indigo-50 rounded-[1.5rem] hover:border-indigo-500 hover:scale-[1.02] transition-all group shadow-sm">
                <div className="bg-indigo-600 text-white p-5 rounded-2xl shadow-lg group-hover:bg-indigo-700 transition">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76" /></svg>
                </div>
                <div className="text-center">
                  <h4 className="font-black text-indigo-900 text-lg">Outlook / Hotmail</h4>
                  <p className="text-[10px] text-indigo-500 font-black uppercase mt-1 tracking-widest">ผ่านเว็บเบราว์เซอร์</p>
                </div>
              </button>

              {/* Method D: Help */}
              <div className="p-8 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[1.5rem] flex flex-col justify-center">
                <h4 className="font-black text-slate-800 mb-2">💡 ทำไมต้องเลือก?</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed font-bold">
                  แอปในเว็บไม่สามารถ "แอบส่งเมลเอง" ได้โดยไม่ผ่านผู้ใช้ (เพื่อความปลอดภัย) 
                  <br /><br />
                  เมื่อท่านกดเลือก แอปจะเตรียม <strong>"ไฟล์ PDF"</strong> และ <strong>"ข้อความ"</strong> ให้ 
                  ท่านเพียงแค่กด <strong>"ส่ง (Send)"</strong> ในแอปเมลที่เปิดขึ้นมาเท่านั้นครับ
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sending Animation Overlay */}
      {isSubmitting && (
        <div className="fixed inset-0 bg-blue-900/90 backdrop-blur-md z-[100] flex flex-col items-center justify-center p-6 text-white text-center">
          <div className="relative mb-10">
             <div className="w-24 h-24 border-8 border-white/20 border-t-white rounded-full animate-spin"></div>
             <div className="absolute inset-0 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
             </div>
          </div>
          
          <div className="space-y-2 max-w-sm">
            <h3 className="text-2xl font-black">
              {sendStage === 'generating' ? 'กำลังสร้างเอกสาร PDF...' : 'กำลังเชื่อมต่อระบบเมล...'}
            </h3>
            <p className="text-white/60 font-bold">
              {sendStage === 'generating' 
                ? 'กรุณารอสักครู่ ระบบกำลังจัดทำเอกสารดิจิทัลที่มีลายเซ็นของท่าน' 
                : 'เรากำลังเตรียมส่งข้อมูลไปยังปลายทางผ่านแอปเมลของท่าน'}
            </p>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {sendStage === 'success' && (
        <div className="fixed inset-0 bg-green-900/95 backdrop-blur-xl z-[110] flex items-center justify-center p-6">
           <div className="bg-white rounded-[2rem] p-10 max-w-md w-full text-center shadow-2xl">
              <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
              </div>
              <h3 className="text-2xl font-black text-slate-800 mb-2">เตรียมการส่งเสร็จสมบูรณ์!</h3>
              <p className="text-slate-500 font-bold mb-8 leading-relaxed">
                แอปเมลของท่านถูกเปิดขึ้นแล้ว <br />
                1. <strong>แนบไฟล์ PDF</strong> (ถ้ายังไม่แนบ) <br />
                2. <strong>กดวาง (Paste)</strong> ข้อความที่ AI ร่างไว้ <br />
                3. กดปุ่ม <strong>"ส่ง (Send)"</strong> ในแอปเมลได้เลย!
              </p>
              <button onClick={() => {setSendStage('idle'); setShowConfigModal(false);}} className="w-full py-4 bg-green-600 text-white rounded-2xl font-black shadow-lg shadow-green-100">
                รับทราบ และปิดหน้าต่างนี้
              </button>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;
