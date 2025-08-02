import type { FC } from "react";
import { useEffect, useState } from "react";
import QRCodeLib from "qrcode";

interface QRCodeGeneratorProps {
  data: string | object;
  size?: number;
}

const QRCodeGenerator: FC<QRCodeGeneratorProps> = ({ data, size = 160 }) => {
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  if (!data) return <div className="text-gray-400">No QR code available</div>;
  const value = typeof data === 'string' ? data : JSON.stringify(data);

  useEffect(() => {
    // Improved QR code settings for better scanner compatibility
    QRCodeLib.toDataURL(value, { 
      width: size, 
      margin: 4, // Increased margin for better scanning
      color: { 
        dark: "#000000", // Pure black for better contrast
        light: "#FFFFFF"  // Pure white background
      },
      errorCorrectionLevel: 'H', // Highest error correction for better scanning
      scale: 8 // Higher scale for better quality
    }, (error: Error | null | undefined, url: string) => {
      if (!error && url) setImgUrl(url);
    });
  }, [value, size]);

  return (
    <div className="w-full flex justify-center">
      <div
        className="bg-black/80 backdrop-blur-lg rounded-xl border border-white/10 shadow-2xl flex flex-col items-center py-6 px-4 transition-transform duration-200 hover:scale-105 max-w-[300px] w-full sm:my-0 my-2"
        style={{ boxShadow: '0 0 24px 4px #a78bfa55' }}
      >
        <span className="text-xl font-bold text-white mb-4 tracking-wider">QR Code</span>
        <div className="rounded-xl p-2 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 shadow-lg flex items-center justify-center">
          {imgUrl ? (
            <img
              src={imgUrl}
              alt="MAS QR Code"
              width={size}
              height={size}
              className="rounded-lg"
              style={{ background: "#18181b" }}
            />
          ) : (
            <div className="text-gray-400">Generating QR...</div>
          )}
        </div>
        <div className="mt-3 text-xs text-purple-200 text-center">
          Long-press the QR code to save it to your Photos.
        </div>
        <button
          onClick={() => {
            if (imgUrl) {
              const link = document.createElement('a');
              link.href = imgUrl;
              link.download = 'mas-qr-code.png';
              link.click();
            }
          }}
          className="mt-2 bg-purple-600 hover:bg-purple-700 text-white text-xs px-3 py-1 rounded-lg transition-colors duration-200"
        >
          Download QR Code
        </button>
      </div>
    </div>
  );
};

export default QRCodeGenerator; 