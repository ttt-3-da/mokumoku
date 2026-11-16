import { useId, type CSSProperties, type SVGProps } from "react";
import { COLORS, DEFAULT_AVATAR, seededRandom, type Avatar, type AvatarForm, type ColorDef, FORM_STACK, FORM_STACK_STEP } from "@/lib/avatar";
import { EmoteMark } from "@/components/emote-marks";
import { bodyOutline } from "@/lib/mochi-body";
import type { EmoteId } from "@/lib/emotes";
import { EXTRA_DESKS, EXTRA_HEADS, ExtraDesk, ExtraHead, NeckItem } from "./mochi-accessories";
import { EXTRA_CHEEKS, EXTRA_EYES, EXTRA_MOUTHS, ExtraCheeks, ExtraEyes, ExtraMouth } from "./mochi-parts";

/**
 * アバター「もち」。パーツごとにレイヤーを分けた SVG で、動きはすべて CSS（transform / opacity）。
 *
 * デザインのルール
 * - 体は丸1つ。顔は点の目2つと小さな口だけ
 * - 線はすべて同じ太さ（STROKE）
 * - 手は必要なときだけ小さな丸で描く
 * - 正面向きのみ。影は体の下の楕円1つ
 */

export type MochiState = "idle" | "focus" | "break" | "away";

export type MochiProps = {
  avatar?: Avatar;
  size?: number;
  state?: MochiState;
  /** まばたきのタイミングをずらすための値（ユーザーIDなど） */
  seed?: string;
  /** 連続集中の段階（1: 頭から湯気、2: ほっぺが赤くて目がキラキラ） */
  heat?: 0 | 1 | 2;
  /** ポモドーロ完了：両手を上げてぴょんと跳ね、紙吹雪 */
  celebrate?: boolean;
  /** スタンプを受け取った：ぴょんと跳ねてハート */
  hop?: boolean;
  /** 顔を見合わせる向き */
  look?: "left" | "right" | null;
  /** 退室：手を振ってふわっと消える */
  leaving?: boolean;
  /** エモート（よろしく・おじぎ・ひらめき など） */
  emote?: EmoteId | null;
  className?: string;
  /** 読み上げ用のラベル。省略すると装飾扱い */
  label?: string;
};

const INK = "#3f3a36";
const STROKE = 2.6;
const EYE_L = 38;
const EYE_R = 62;
const EYE_Y = 60;

const HACHIMAKI_COLOR = { red: "#e45b5b", indigo: "#4a5aa6" } as const;
const CHEEK_COLOR = { none: null, pink: "#ff9fb3", orange: "#ffb36b" } as const;

const CONFETTI = [
  { x: 20, y: 30, dx: -16, dy: -22, rot: 160, c: "#f4a6b8" },
  { x: 30, y: 22, dx: -8, dy: -28, rot: -120, c: "#8fb98b" },
  { x: 44, y: 18, dx: -2, dy: -30, rot: 200, c: "#ffd34d" },
  { x: 56, y: 18, dx: 4, dy: -30, rot: -180, c: "#8ec6de" },
  { x: 70, y: 22, dx: 10, dy: -26, rot: 140, c: "#cdb7e6" },
  { x: 80, y: 30, dx: 16, dy: -20, rot: -150, c: "#ffb36b" },
];

export function Mochi({
  avatar = DEFAULT_AVATAR,
  size = 64,
  state = "idle",
  seed = "mochi",
  heat = 0,
  celebrate = false,
  hop = false,
  look = null,
  leaving = false,
  emote = null,
  className = "",
  label,
}: MochiProps) {
  const uid = useId().replace(/:/g, "");
  const color = COLORS[avatar.color] ?? COLORS.shiro;
  const form = avatar.form ?? "round";
  // 暗い体の色では、目や口を明るい色で描く
  const ink = color.dark ? "#fff8ec" : INK;
  const bodyFill = color.paint ? `url(#paint-${uid})` : color.fill;
  const away = state === "away";
  const focus = state === "focus";
  const onBreak = state === "break";
  const hot = heat >= 2 && !away;

  // まばたき・「…！」のタイミングをキャラごとにずらす
  const vars = {
    width: size,
    height: size,
    "--blink-dur": `${(3.6 + seededRandom(seed, 1) * 3).toFixed(2)}s`,
    "--blink-delay": `${(seededRandom(seed, 2) * -6).toFixed(2)}s`,
    "--bang-delay": `${(seededRandom(seed, 3) * -9).toFixed(2)}s`,
    "--breathe-delay": `${(seededRandom(seed, 4) * -3).toFixed(2)}s`,
  } as CSSProperties;

  // 連続集中2時間超は、どのほっぺでも赤くする
  const cheek = hot || emote === "blush" ? "#ff6b6b" : avatar.cheeks in CHEEK_COLOR ? CHEEK_COLOR[avatar.cheeks as keyof typeof CHEEK_COLOR] : null;
  const emoteEyes =
    emote === "bow" || emote === "doze" || emote === "nod" || emote === "relief"
      ? "closed"
      : emote === "idea" || emote === "fire" || emote === "shine"
        ? "sparkle"
        : emote === "joy" || emote === "stretch" || emote === "wave" || emote === "blush" || emote === "groove" || emote === "cheer" || emote === "spin"
          ? "smile"
          : emote === "shock" || emote === "jiggle" || emote === "hmm" || emote === "hungry" || emote === "tall"
            ? "dot"
            : null;
  const eyes = emoteEyes ?? (away ? "closed" : hot ? "sparkle" : avatar.eyes);
  // エモートや完了の演出中は、ペン・湯のみ・「…！」をしまう
  const busy = celebrate || emote !== null;
  const handsUp = celebrate || emote === "joy" || emote === "stretch" || emote === "groove";

  const classes = [
    "mochi relative inline-block shrink-0",
    `mochi-${state}`,
    celebrate && "mochi-celebrate",
    hop && "mochi-hop",
    leaving && "mochi-leaving",
    look && `mochi-look-${look}`,
    emote && `mochi-emote mochi-emote-${emote}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const stack = FORM_STACK[form] + 1;
  // もち1つぶん。top：一番上のもち（首・頭の小物と手はここにだけ付ける）
  const figure = (top: boolean, copy = 0) => (
    <>
              {/* 体 */}
              <BodyShape form={form} copy={copy} fill={bodyFill} stroke={color.edge} strokeWidth={STROKE} />
              {/* 体の上にのるもの（顔・アクセサリー・ハチマキ・手）。もちの部屋で引っぱられたとき、いっしょに動く（data-mochi-face） */}
              <g data-mochi-face={copy} style={STACK_BOX}>
              {color.shine && (
                // きんいろ：左上に光の反射
                <g fill="#fff" clipPath={`url(#body-${uid})`}>
                  <ellipse className="mp-fixed" cx="34" cy="44" rx="10" ry="4.5" opacity="0.6" transform="rotate(-25 34 44)" />
                  <circle cx="45" cy="40" r="2" opacity="0.7" />
                </g>
              )}

              {/* 集中中はハチマキ */}
              {focus && (
                <g>
                  <rect
                    x="10"
                    y="41"
                    width="80"
                    height="7"
                    fill={HACHIMAKI_COLOR[avatar.hachimaki]}
                    clipPath={`url(#body-${uid})`}
                  />
                  <ellipse className="mp-fixed" cx="85" cy="47" rx="5" ry="3" fill={HACHIMAKI_COLOR[avatar.hachimaki]} transform="rotate(25 85 47)" />
                  <ellipse className="mp-fixed" cx="86" cy="52" rx="4.5" ry="2.6" fill={HACHIMAKI_COLOR[avatar.hachimaki]} transform="rotate(60 86 52)" />
                </g>
              )}

              {/* ほっぺ */}
              {cheek ? (
                <g fill={cheek} opacity={hot || emote === "blush" ? 0.8 : 0.65}>
                  <ellipse cx="29" cy="68" rx="5.5" ry="3.4" />
                  <ellipse cx="71" cy="68" rx="5.5" ry="3.4" />
                </g>
              ) : (
                EXTRA_CHEEKS.has(avatar.cheeks) && <ExtraCheeks kind={avatar.cheeks} ink={ink} uid={uid} />
              )}

              {/* 目（外側のグループで向き、内側でまばたき） */}
              <g className="mochi-look">
                <g className={away ? undefined : "mochi-eyes"}>
                  <Eyes kind={eyes} ink={ink} uid={uid} />
                </g>
              </g>

              <Mouth kind={avatar.mouth} ink={ink} />

              {top && (
                <>
                  <NeckItem kind={avatar.neck} uid={uid} />
                  {EXTRA_HEADS.has(avatar.head) ? (
                    <ExtraHead kind={avatar.head} ink={ink} fill={color.fill} edge={color.edge} />
                  ) : (
                    <HeadItem kind={avatar.head} />
                  )}
                </>
              )}

              {/* 手（必要なときだけ小さな丸） */}
              {top && focus && !busy && (
                <g className="mochi-pen">
                  <rect className="mp-fixed" x="72" y="66" width="3.4" height="17" rx="1.2" fill="#5b8def" transform="rotate(35 73.7 74.5)" />
                  <circle cx="74" cy="82" r="4.6" fill={color.fill} stroke={color.edge} strokeWidth={STROKE} />
                </g>
              )}
              {top && onBreak && !busy && (
                <g className="mochi-cup">
                  <rect x="41" y="73" width="18" height="14" rx="4" fill="#8fb98b" />
                  <rect x="44" y="77" width="12" height="2.6" rx="1.3" fill="#fff" opacity="0.5" />
                  <circle cx="40" cy="82" r="4.4" fill={color.fill} stroke={color.edge} strokeWidth={STROKE} />
                  <circle cx="60" cy="82" r="4.4" fill={color.fill} stroke={color.edge} strokeWidth={STROKE} />
                  <g fill="none" stroke="#c9bfb3" strokeWidth={STROKE} strokeLinecap="round">
                    <path className="mochi-steam" d="M46 69 q-2 -3 0 -6 q2 -3 0 -6" />
                    <path className="mochi-steam mochi-steam-2" d="M54 69 q-2 -3 0 -6 q2 -3 0 -6" />
                  </g>
                </g>
              )}
              {top && handsUp && (
                <g className={emote === "stretch" ? "mochi-hands-stretch" : undefined} fill={color.fill} stroke={color.edge} strokeWidth={STROKE}>
                  <circle cx="13" cy="44" r="4.8" />
                  <circle cx="87" cy="44" r="4.8" />
                </g>
              )}
              {top && (leaving || emote === "wave" || emote === "cheer") && (
                <g className="mochi-wave">
                  <circle cx="86" cy="52" r="4.8" fill={color.fill} stroke={color.edge} strokeWidth={STROKE} />
                </g>
              )}
              </g>
    </>
  );

  return (
    <div className={classes} style={vars} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        overflow="visible"
        // キングもちは足もとを基準に大きくする（並びの幅は変えない）
        style={form === "king" ? { transform: "scale(1.7)", transformOrigin: "50% 92%" } : undefined}
      >
        <defs>
          {color.paint && <BodyPaint id={`paint-${uid}`} paint={color.paint} />}
          <clipPath id={`body-${uid}`}>
            <BodyShape form={form} />
          </clipPath>
        </defs>

        {/* 影 */}
        <ellipse className="mochi-shadow" cx="50" cy="93" rx="28" ry="4" fill="#000" opacity="0.1" />

        <g className="mochi-jump">
          <g className="mochi-pose">
            <g className="mochi-breathe">
              {/* 2段・3段もちは、同じもちを積んで、全体が枠に入るように小さくする（どのもちにも顔がある） */}
              <g style={STACK_BOX} transform={stack > 1 ? `translate(50 90) scale(${88 / (56 + (stack - 1) * FORM_STACK_STEP)}) translate(-50 -90)` : undefined}>
                {Array.from({ length: stack }, (_, i) => (
                  <g key={i} style={STACK_BOX} transform={i > 0 ? `translate(0 ${-i * FORM_STACK_STEP})` : undefined}>
                    {figure(i === stack - 1, i)}
                  </g>
                ))}
              </g>
            </g>
          </g>
        </g>

        {/* 状態を表す記号（色だけに頼らない） */}
        {emote && <EmoteMark emote={emote} />}
        {focus && !busy && (
          <text className="mochi-bang" x="80" y="30" fontSize="15" fontWeight="bold" fill={INK}>
            …!
          </text>
        )}
        {away && (
          <g fill={INK} fontWeight="bold">
            <text className="mochi-zzz" x="74" y="34" fontSize="12">
              z
            </text>
            <text className="mochi-zzz mochi-zzz-2" x="82" y="24" fontSize="15">
              Z
            </text>
          </g>
        )}
        {heat >= 1 && focus && (
          <g fill="none" stroke="#d9cfc4" strokeWidth={STROKE} strokeLinecap="round">
            <path className="mochi-steam" d="M40 30 q-2 -3 0 -6 q2 -3 0 -6" />
            <path className="mochi-steam mochi-steam-2" d="M50 27 q-2 -3 0 -6 q2 -3 0 -6" />
            <path className="mochi-steam mochi-steam-3" d="M60 30 q-2 -3 0 -6 q2 -3 0 -6" />
          </g>
        )}
        {hop && (
          <path
            className="mochi-heart"
            d="M50 24 c-6 -5 -12 -1 -10 4 c1.5 3.5 6 6 10 9 c4 -3 8.5 -5.5 10 -9 c2 -5 -4 -9 -10 -4 z"
            fill="#ff7c96"
          />
        )}
        {celebrate &&
          CONFETTI.map((p, i) => (
            <rect
              key={i}
              className="mochi-confetti"
              x={p.x}
              y={p.y}
              width="4"
              height="6"
              rx="1"
              fill={p.c}
              style={{ "--dx": `${p.dx}px`, "--dy": `${p.dy}px`, "--rot": `${p.rot}deg` } as CSSProperties}
            />
          ))}
      </svg>
    </div>
  );
}

function Eyes({ kind, ink = INK, uid = "" }: { kind: Avatar["eyes"] | "closed"; ink?: string; uid?: string }) {
  if (EXTRA_EYES.has(kind)) return <ExtraEyes kind={kind} ink={ink} uid={uid} />;
  const line = { fill: "none", stroke: ink, strokeWidth: STROKE, strokeLinecap: "round" as const };
  switch (kind) {
    case "closed":
      return (
        <g {...line}>
          <path d={`M${EYE_L - 4} ${EYE_Y} q4 3.5 8 0`} />
          <path d={`M${EYE_R - 4} ${EYE_Y} q4 3.5 8 0`} />
        </g>
      );
    case "smile":
      return (
        <g {...line}>
          <path d={`M${EYE_L - 4} ${EYE_Y + 1.5} q4 -5 8 0`} />
          <path d={`M${EYE_R - 4} ${EYE_Y + 1.5} q4 -5 8 0`} />
        </g>
      );
    case "sleepy":
      return (
        <g {...line}>
          <path d={`M${EYE_L - 4.5} ${EYE_Y} h9`} />
          <path d={`M${EYE_R - 4.5} ${EYE_Y} h9`} />
          <circle cx={EYE_L} cy={EYE_Y + 1.8} r="1.6" fill={ink} stroke="none" />
          <circle cx={EYE_R} cy={EYE_Y + 1.8} r="1.6" fill={ink} stroke="none" />
        </g>
      );
    case "sparkle":
      return (
        <g>
          {[EYE_L, EYE_R].map((x) => (
            <g key={x}>
              <circle cx={x} cy={EYE_Y} r="4.4" fill={ink} />
              <circle cx={x - 1.4} cy={EYE_Y - 1.5} r="1.6" fill="#fff" />
              <circle cx={x + 1.5} cy={EYE_Y + 1.6} r="0.8" fill="#fff" />
            </g>
          ))}
        </g>
      );
    case "glasses":
      return (
        <g>
          <circle cx={EYE_L} cy={EYE_Y} r="3" fill={ink} />
          <circle cx={EYE_R} cy={EYE_Y} r="3" fill={ink} />
          <g {...line}>
            <circle cx={EYE_L} cy={EYE_Y} r="7.5" />
            <circle cx={EYE_R} cy={EYE_Y} r="7.5" />
            <path d={`M${EYE_L + 7.5} ${EYE_Y} h${EYE_R - EYE_L - 15}`} />
          </g>
        </g>
      );
    case "dot":
    default:
      return (
        <g fill={ink}>
          <circle cx={EYE_L} cy={EYE_Y} r="3.4" />
          <circle cx={EYE_R} cy={EYE_Y} r="3.4" />
        </g>
      );
  }
}

function Mouth({ kind, ink = INK }: { kind: Avatar["mouth"]; ink?: string }) {
  if (EXTRA_MOUTHS.has(kind)) return <ExtraMouth kind={kind} ink={ink} />;
  const line = { fill: "none", stroke: ink, strokeWidth: STROKE, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (kind) {
    case "small":
      return <circle cx="50" cy="69" r="2.2" fill={ink} />;
    case "smile":
      return <path d="M45 67 q5 5 10 0" {...line} />;
    case "frown":
      return <path d="M45 70.5 l5 -3.5 l5 3.5" {...line} />;
    case "omega":
    default:
      return <path d="M44 67 q3 4 6 0 q3 4 6 0" {...line} />;
  }
}

function HeadItem({ kind }: { kind: Avatar["head"] }) {
  switch (kind) {
    case "ribbon":
      return (
        <g className="mp-fixed" fill="#ff8fab" transform="translate(68 36) rotate(-15)">
          <ellipse cx="-6" cy="0" rx="7" ry="4.6" transform="rotate(-20 -6 0)" />
          <ellipse cx="6" cy="0" rx="7" ry="4.6" transform="rotate(20 6 0)" />
          <circle cx="0" cy="0" r="3" fill="#ff7096" />
        </g>
      );
    case "leaf":
      return (
        <g>
          <rect x="49" y="26" width="2.6" height="9" rx="1.3" fill="#6aa35c" />
          <ellipse className="mp-fixed" cx="57" cy="25" rx="8" ry="4.4" fill="#7cbf6a" transform="rotate(-25 57 25)" />
        </g>
      );
    case "crown":
      return <path d="M37 37 L39 21 L45 29 L50 18 L55 29 L61 21 L63 37 Z" fill="#ffd34d" />;
    case "none":
    default:
      return null;
  }
}

/** 机の小物（席の机の上に置く）。観葉植物は level で育つ（1〜3） */
export function DeskItem({ kind, size = 28, level = 1 }: { kind: Avatar["desk"]; size?: number; level?: 1 | 2 | 3 }) {
  if (kind === "none") return null;
  if (EXTRA_DESKS.has(kind)) {
    return (
      <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden className="shrink-0">
        <ExtraDesk kind={kind} />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden className="shrink-0">
      {kind === "mug" && (
        <g>
          <rect x="9" y="16" width="17" height="19" rx="4" fill="#f4a6b8" />
          <path d="M26 21 h3 a4 4 0 0 1 0 8 h-3" fill="none" stroke="#f4a6b8" strokeWidth={STROKE} />
          <g fill="none" stroke="#d9cfc4" strokeWidth={STROKE} strokeLinecap="round">
            <path className="mochi-steam" d="M15 13 q-2 -3 0 -6" />
            <path className="mochi-steam mochi-steam-2" d="M20 13 q-2 -3 0 -6" />
          </g>
        </g>
      )}
      {kind === "lamp" && (
        <g>
          <rect x="17" y="18" width="3" height="16" rx="1.5" fill="#a89b8c" />
          <ellipse cx="18.5" cy="35" rx="8" ry="2.6" fill="#a89b8c" />
          <path d="M8 18 L13 6 L25 6 L30 18 Z" fill="#ffd34d" />
          <ellipse cx="19" cy="22" rx="10" ry="4" fill="#fff2b3" opacity="0.6" />
        </g>
      )}
      {kind === "plant" && (
        <g>
          <path d="M12 26 h16 l-2 10 h-12 z" fill="#d9a066" />
          <g fill="#7cbf6a">
            <ellipse cx="20" cy="21" rx="3.4" ry="6" />
            {level >= 2 && <ellipse cx="14" cy="18" rx="3" ry="6" transform="rotate(-35 14 18)" />}
            {level >= 2 && <ellipse cx="26" cy="18" rx="3" ry="6" transform="rotate(35 26 18)" />}
            {level >= 3 && <ellipse cx="20" cy="10" rx="3.4" ry="6.4" />}
            {level >= 3 && <ellipse cx="11" cy="11" rx="2.6" ry="5" transform="rotate(-55 11 11)" />}
            {level >= 3 && <ellipse cx="29" cy="11" rx="2.6" ry="5" transform="rotate(55 29 11)" />}
          </g>
        </g>
      )}
      {kind === "pet" && (
        <g className="mochi-breathe">
          <ellipse cx="20" cy="37" rx="11" ry="2" fill="#000" opacity="0.1" />
          <ellipse cx="20" cy="27" rx="13" ry="10" fill="#fffdf7" stroke="#e6d9c6" strokeWidth={STROKE} />
          <circle cx="15.5" cy="26" r="1.6" fill={INK} />
          <circle cx="24.5" cy="26" r="1.6" fill={INK} />
          <ellipse cx="12" cy="29.5" rx="2.2" ry="1.4" fill="#ff9fb3" opacity="0.65" />
          <ellipse cx="28" cy="29.5" rx="2.2" ry="1.4" fill="#ff9fb3" opacity="0.65" />
        </g>
      )}
    </svg>
  );
}

/**
 * もちの体の形。顔（目は y=60、口は y=68 あたり）が体の上に来るように描く。
 * 段のある形は下の段から順に重ねる
 */
/** 積むための移動・縮小は viewBox を基準にする（.mochi g の fill-box だと右にずれる） */
const STACK_BOX: CSSProperties = { transformBox: "view-box", transformOrigin: "0 0" };

/** copy：積んだもちの何段目か。もちの部屋で、つまんだところを出っ張らせる目印（data-mochi-body） */
function BodyShape({ form, copy, ...paint }: { form: AvatarForm; copy?: number } & SVGProps<SVGPathElement>) {
  return <path d={bodyOutline(form === "square")} data-mochi-body={copy} strokeLinejoin="round" {...paint} />;
}

/** 体の塗り分け。bands は上から等分の色の帯、gradient はなめらかなグラデーション */
export function BodyPaint({ id, paint }: { id: string; paint: NonNullable<ColorDef["paint"]> }) {
  const n = paint.stops.length;
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      {paint.kind === "gradient"
        ? paint.stops.map((c, i) => <stop key={i} offset={n === 1 ? 0 : i / (n - 1)} stopColor={c} />)
        : paint.stops.flatMap((c, i) => [
            <stop key={`${i}a`} offset={i / n} stopColor={c} />,
            <stop key={`${i}b`} offset={(i + 1) / n} stopColor={c} />,
          ])}
    </linearGradient>
  );
}
