import { IsString, IsNotEmpty, IsInt, Min, Max } from 'class-validator';

export class PresignDto {
  @IsString() @IsNotEmpty() filename!: string;
  @IsString() @IsNotEmpty() contentType!: string;
  @IsInt() @Min(1) @Max(26_214_400) size!: number;
}
