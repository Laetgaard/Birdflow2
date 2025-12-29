import { useState, useEffect, useRef } from 'react';

type CropData = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type ImageValue = {
  url: string;
  mediaId?: string;
  crop?: CropData;
};

type Props = {
  image: string | ImageValue;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
  containerClassName?: string;
};

function parseImageValue(value: string | ImageValue): ImageValue {
  if (typeof value === 'string') {
    return { url: value };
  }
  return value;
}

export default function CroppedImage({ image, alt = '', className = '', style = {}, containerClassName = '' }: Props) {
  const { url, crop } = parseImageValue(image);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!url) return;
    
    const img = new Image();
    img.onload = () => {
      setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = url;
  }, [url]);

  if (!url) {
    return null;
  }

  if (!crop || !naturalSize) {
    return (
      <img
        ref={imgRef}
        src={url}
        alt={alt}
        className={className}
        style={style}
        data-testid="cropped-image"
      />
    );
  }

  const scaleX = naturalSize.width / crop.width;
  const scaleY = naturalSize.height / crop.height;

  return (
    <div 
      className={`overflow-hidden ${containerClassName}`}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
      }}
      data-testid="cropped-image-container"
    >
      <img
        ref={imgRef}
        src={url}
        alt={alt}
        className={className}
        style={{
          ...style,
          position: 'absolute',
          width: `${scaleX * 100}%`,
          height: `${scaleY * 100}%`,
          maxWidth: 'none',
          objectFit: 'cover',
          left: `${-(crop.x / crop.width) * 100}%`,
          top: `${-(crop.y / crop.height) * 100}%`,
        }}
        data-testid="cropped-image"
      />
    </div>
  );
}

export function getCroppedImageStyle(image: string | ImageValue): React.CSSProperties {
  const { url, crop } = parseImageValue(image);
  
  if (!crop) {
    return {
      backgroundImage: `url(${url})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    };
  }

  return {
    backgroundImage: `url(${url})`,
    backgroundSize: `auto`,
    backgroundPosition: `-${crop.x}px -${crop.y}px`,
  };
}

export { parseImageValue };
export type { CropData, ImageValue };
