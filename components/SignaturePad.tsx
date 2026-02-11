
import React, { useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';

interface SignaturePadProps {
  onSave: (dataUrl: string) => void;
  onClear: () => void;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({ onSave, onClear }) => {
  const sigCanvas = useRef<SignatureCanvas | null>(null);

  const handleClear = () => {
    sigCanvas.current?.clear();
    onClear();
  };

  const handleSave = () => {
    if (sigCanvas.current?.isEmpty()) return;
    const dataUrl = sigCanvas.current?.getTrimmedCanvas().toDataURL('image/png') || '';
    onSave(dataUrl);
  };

  // Fix: Cast SignatureCanvas to any to bypass strict prop-checking for penColor and ref
  // which can occur with certain versions of @types/react-signature-canvas and React 18+
  const SignatureCanvasComponent = SignatureCanvas as any;

  return (
    <div className="border border-gray-300 rounded-lg p-2 bg-white">
      <div className="bg-gray-50 mb-2 border border-dashed border-gray-400">
        <SignatureCanvasComponent
          // Ensure the ref callback handles the instance correctly with an explicit type cast
          ref={(ref: any) => { sigCanvas.current = ref; }}
          penColor="navy"
          canvasProps={{
            width: 400,
            height: 150,
            className: 'signature-canvas w-full h-32'
          }}
          onEnd={handleSave}
        />
      </div>
      <div className="flex justify-between items-center text-xs">
        <span className="text-gray-500 italic">ลงลายมือชื่อในช่องว่างด้านบน</span>
        <button
          type="button"
          onClick={handleClear}
          className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-gray-700 transition"
        >
          ล้างลายเซ็น
        </button>
      </div>
    </div>
  );
};
