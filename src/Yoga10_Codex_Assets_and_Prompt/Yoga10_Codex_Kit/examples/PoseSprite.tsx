import type { CSSProperties } from "react";

export interface PoseAsset {
  atlas: string;
  columns: number;
  rows: number;
  column: number;
  row: number;
  cellAspectRatio: number;
  alt: string;
}

interface Props {
  asset: PoseAsset;
  className?: string;
}

/** Use with the included 3-column, 2-row opaque PNG atlases. */
export function PoseSprite({ asset, className = "" }: Props) {
  const x = asset.columns === 1 ? 0 : (asset.column / (asset.columns - 1)) * 100;
  const y = asset.rows === 1 ? 0 : (asset.row / (asset.rows - 1)) * 100;
  const style: CSSProperties = {
    width: "100%",
    aspectRatio: asset.cellAspectRatio,
    backgroundImage: `url("${asset.atlas}")`,
    backgroundSize: `${asset.columns * 100}% ${asset.rows * 100}%`,
    backgroundPosition: `${x}% ${y}%`,
    backgroundRepeat: "no-repeat",
  };
  return <div role="img" aria-label={asset.alt} className={`pose-sprite ${className}`} style={style} />;
}
