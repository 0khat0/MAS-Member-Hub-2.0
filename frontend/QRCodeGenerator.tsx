import { FC } from "react";
import QRCode from "qrcode.react";

interface QRCodeGeneratorProps {
  data: object; // The object to encode in the QR code
  size?: number;
}

const QRCodeGenerator: FC<QRCodeGeneratorProps> = ({ data, size = 160 }) => {
  if (!data) return <div className="text-gray-400">No QR code available</div>;
  const value = JSON.stringify(data);
  return (
    <div className="flex flex-col items-center">
      <QRCode value={value} size={size} bgColor="#fff" fgColor="#111" />
      <div className="text-xs text-gray-400 mt-2 break-all max-w-xs text-center">{value}</div>
    </div>
  );
};

export default QRCodeGenerator;
