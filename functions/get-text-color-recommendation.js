const OpenAI = require('openai');

exports.handler = async (event) => {
    // CORS 헤더
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    // OPTIONS 요청 처리
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    // POST 요청만 허용
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method Not Allowed' })
        };
    }

    try {
        const { backgroundColor } = JSON.parse(event.body);

        console.log('📥 AI 텍스트 색상 추천 요청:', { backgroundColor });

        // OpenAI API 키 확인
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OPENAI_API_KEY가 설정되지 않았습니다.');
        }

        // OpenAI 클라이언트 초기화
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });

        // AI에게 텍스트 색상 추천 요청
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `당신은 접근성을 고려한 색상 디자인 전문가입니다. 
배경색이 주어지면, WCAG AA 기준(4.5:1 이상)을 만족하는 최적의 텍스트 색상을 추천해주세요.
단순히 흰색/검정색만 추천하지 말고, 배경색과 조화를 이루면서도 명도 대비가 충분한 색상을 추천해주세요.

응답은 반드시 다음 JSON 형식으로만 작성하세요:
{
  "textColor": "#RRGGBB",
  "contrastRatio": 7.5,
  "reasoning": "이 색상을 추천한 이유"
}`
                },
                {
                    role: "user",
                    content: `배경색: ${backgroundColor}

이 배경색에 가장 잘 어울리면서 접근성을 만족하는 텍스트 색상을 추천해주세요.`
                }
            ],
            temperature: 0.7,
            max_tokens: 300
        });

        const responseText = completion.choices[0].message.content.trim();
        console.log('AI 원본 응답:', responseText);

        // JSON 파싱
        let aiResponse;
        try {
            // JSON 코드 블록 제거
            const jsonText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            aiResponse = JSON.parse(jsonText);
        } catch (parseError) {
            console.error('JSON 파싱 실패:', parseError);
            // 파싱 실패 시 기본값 사용
            aiResponse = {
                textColor: getLuminance(backgroundColor) > 0.5 ? '#000000' : '#FFFFFF',
                contrastRatio: 0,
                reasoning: 'AI 응답 파싱에 실패하여 기본 색상을 사용했습니다.'
            };
        }

        console.log('✅ AI 텍스트 색상 추천 성공:', aiResponse);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(aiResponse)
        };

    } catch (error) {
        console.error('❌ 텍스트 색상 추천 실패:', error);

        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: '텍스트 색상 추천 실패',
                message: error.message,
                textColor: '#000000',
                reasoning: '오류가 발생하여 기본 색상을 사용했습니다.'
            })
        };
    }
};

// Luminance 계산 함수
function getLuminance(hex) {
    const rgb = hexToRgb(hex);
    if (!rgb) return 0;
    
    const [r, g, b] = [rgb.r, rgb.g, rgb.b].map(c => {
        c /= 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}