import { SITE_NAME, SITE_TAGLINE } from '@/lib/site';

export function ShareImage() {
  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        height: '100%',
        padding: '44px',
        background: '#f4ede0',
        color: '#1d1a12',
      }}
    >
      <div
        style={{
          position: 'relative',
          display: 'flex',
          width: '100%',
          borderRadius: '38px',
          border: '1px solid rgba(29, 26, 18, 0.12)',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.46) 0%, rgba(236,227,210,0.82) 100%)',
          boxShadow: '0 18px 40px -26px rgba(29, 26, 18, 0.28)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '-120px',
            right: '-60px',
            width: '360px',
            height: '360px',
            borderRadius: '999px',
            background: 'rgba(171, 127, 62, 0.16)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-110px',
            left: '-70px',
            width: '300px',
            height: '300px',
            borderRadius: '999px',
            background: 'rgba(29, 26, 18, 0.08)',
          }}
        />

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            width: '100%',
            padding: '56px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div
                style={{
                  display: 'flex',
                  width: 56,
                  height: 56,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 18,
                  background: 'rgba(171, 127, 62, 0.18)',
                  border: '1px solid rgba(171, 127, 62, 0.28)',
                  color: '#5f4522',
                  fontSize: 24,
                  fontWeight: 700,
                  letterSpacing: 0,
                }}
              >
                叨
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span
                  style={{
                    fontSize: '24px',
                    letterSpacing: '0.22em',
                    textTransform: 'uppercase',
                  }}
                >
                  {SITE_NAME}
                </span>
                <span
                  style={{
                    fontSize: '20px',
                    color: 'rgba(29, 26, 18, 0.68)',
                  }}
                >
                  {SITE_TAGLINE}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '820px' }}>
              <span
                style={{
                  fontSize: '22px',
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: 'rgba(29, 26, 18, 0.48)',
                }}
              >
                Speak · Understand · Surface
              </span>
              <span
                style={{
                  fontSize: '74px',
                  lineHeight: 1.08,
                  fontWeight: 700,
                  letterSpacing: '-0.04em',
                }}
              >
                说一句话，AI 就把小事收成待办。
              </span>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              gap: '24px',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                maxWidth: '640px',
              }}
            >
              <span style={{ fontSize: '28px', lineHeight: 1.5, color: 'rgba(29, 26, 18, 0.76)' }}>
                意图驱动的 AI 语音轻量任务调度。
              </span>
              <span
                style={{
                  fontSize: '18px',
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: 'rgba(29, 26, 18, 0.54)',
                }}
              >
                paper, deliberate, calm
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '12px 18px',
                borderRadius: '999px',
                background: 'rgba(171, 127, 62, 0.12)',
                border: '1px solid rgba(171, 127, 62, 0.24)',
                fontSize: '20px',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: '#5f4522',
              }}
            >
              muimemo.roudan.io
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
