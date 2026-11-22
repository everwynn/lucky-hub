/**
 * 全站共享的数据结构。
 *
 * Draw 原先在 format.ts 与 generate.ts 各定义一次，结构相同（TS 结构化类型下可互通），
 * 但新增字段时要改两处、漏一处不报错。这里统一为唯一来源，两处只做 re-export，
 * 现有 import 路径保持不变。
 */
export interface Draw {
  code: string;
  date: string;
  red: number[];
  blue: number;
}
