<script setup>
import { ref, reactive, computed, nextTick, watch, onMounted } from 'vue'
import html2canvas from 'html2canvas'
import { quizQuestions, quizResults } from '../../src/data/quizData.js'

const PAGE_STATE = {
  HOME: 'HOME',
  QUIZ: 'QUIZ',
  RESULT: 'RESULT'
}

const POSTER_TIMEOUT_MS = 12000
const POSTER_RETRY_TIMES = 1
const AUTO_NEXT_DELAY_MS = 140
const FALLBACK_RESULT_KEY = 'WEIRDO'
const VALID_OPTION_VALUES = new Set(['N', 'M', 'G', 'D', 'T', 'C', 'J', 'B'])

const currentStep = ref(PAGE_STATE.HOME)
const currentQuestionIndex = ref(0)

const userState = reactive({
  college: '',
  answers: {}
})

const finalResultCode = ref('')
const finalDimensionScores = ref(null)

const posterNode = ref(null)
const posterImageBase64 = ref('')
const isGeneratingPoster = ref(false)
const posterError = ref('')
const shareFeedback = ref('')

const collegeThemeMap = {
  default: {
    pageGradient: 'linear-gradient(180deg, #fee2e2 0%, #ffedd5 50%, #fef9c3 100%)',
    posterGradient: 'linear-gradient(180deg, #fde047 0%, #fdba74 50%, #fca5a5 100%)',
    tagBg: '#000000',
    tagColor: '#ffffff',
    borderColor: '#111827',
    actionColor: '#111827'
  },
  cs: {
    pageGradient: 'linear-gradient(180deg, #dbeafe 0%, #bfdbfe 55%, #e0f2fe 100%)',
    posterGradient: 'linear-gradient(180deg, #93c5fd 0%, #60a5fa 45%, #bae6fd 100%)',
    tagBg: '#0f172a',
    tagColor: '#ffffff',
    borderColor: '#0f172a',
    actionColor: '#1d4ed8'
  },
  cybersecurity: {
    pageGradient: 'linear-gradient(180deg, #dcfce7 0%, #bbf7d0 55%, #ecfccb 100%)',
    posterGradient: 'linear-gradient(180deg, #86efac 0%, #4ade80 45%, #bef264 100%)',
    tagBg: '#052e16',
    tagColor: '#ffffff',
    borderColor: '#14532d',
    actionColor: '#15803d'
  },
  governance: {
    pageGradient: 'linear-gradient(180deg, #fee2e2 0%, #fecaca 55%, #ffedd5 100%)',
    posterGradient: 'linear-gradient(180deg, #fca5a5 0%, #f87171 45%, #fdba74 100%)',
    tagBg: '#7f1d1d',
    tagColor: '#ffffff',
    borderColor: '#7f1d1d',
    actionColor: '#b91c1c'
  },
  law: {
    pageGradient: 'linear-gradient(180deg, #e5e7eb 0%, #d1d5db 50%, #f3f4f6 100%)',
    posterGradient: 'linear-gradient(180deg, #d1d5db 0%, #9ca3af 45%, #e5e7eb 100%)',
    tagBg: '#111827',
    tagColor: '#ffffff',
    borderColor: '#111827',
    actionColor: '#374151'
  },
  business: {
    pageGradient: 'linear-gradient(180deg, #ffedd5 0%, #fed7aa 55%, #fef3c7 100%)',
    posterGradient: 'linear-gradient(180deg, #fdba74 0%, #fb923c 45%, #fcd34d 100%)',
    tagBg: '#7c2d12',
    tagColor: '#ffffff',
    borderColor: '#7c2d12',
    actionColor: '#c2410c'
  },
  engineering: {
    pageGradient: 'linear-gradient(180deg, #cffafe 0%, #a5f3fc 55%, #e0f2fe 100%)',
    posterGradient: 'linear-gradient(180deg, #67e8f9 0%, #22d3ee 45%, #93c5fd 100%)',
    tagBg: '#083344',
    tagColor: '#ffffff',
    borderColor: '#0e7490',
    actionColor: '#0891b2'
  },
  science: {
    pageGradient: 'linear-gradient(180deg, #ede9fe 0%, #ddd6fe 55%, #e9d5ff 100%)',
    posterGradient: 'linear-gradient(180deg, #c4b5fd 0%, #a78bfa 45%, #d8b4fe 100%)',
    tagBg: '#4c1d95',
    tagColor: '#ffffff',
    borderColor: '#5b21b6',
    actionColor: '#6d28d9'
  },
  humanities: {
    pageGradient: 'linear-gradient(180deg, #fae8ff 0%, #f5d0fe 55%, #fde68a 100%)',
    posterGradient: 'linear-gradient(180deg, #f0abfc 0%, #e879f9 45%, #fcd34d 100%)',
    tagBg: '#701a75',
    tagColor: '#ffffff',
    borderColor: '#701a75',
    actionColor: '#a21caf'
  },
  other: {
    pageGradient: 'linear-gradient(180deg, #fef9c3 0%, #fde68a 55%, #fdba74 100%)',
    posterGradient: 'linear-gradient(180deg, #fde047 0%, #facc15 45%, #fb923c 100%)',
    tagBg: '#422006',
    tagColor: '#ffffff',
    borderColor: '#78350f',
    actionColor: '#b45309'
  }
}

const collegeMap = {
  cs: '计算机学院',
  cybersecurity: '网安学院',
  governance: '政管学院',
  law: '法学院',
  business: '商学院',
  engineering: '工程学院',
  science: '理学院',
  humanities: '文学院',
  other: '其他学院'
}

const resultCodeMap = {
  NGTJ: 'CEO',
  NGTB: 'MONKEY',
  NGCJ: 'MOM',
  NGCB: 'FLOWER',
  NDTJ: 'SCAMMER',
  NDTB: 'TROLL',
  NDCJ: 'SAINT',
  NDCB: 'PUPPY',
  MGTJ: 'BOT',
  MGTB: 'GHOST',
  MGCJ: 'DOORMAT',
  MGCB: 'CUTE',
  MDTJ: 'HATER',
  MDTB: 'WEIRDO',
  MDCJ: 'MONK',
  MDCB: 'WATER'
}

const totalQuestions = quizQuestions.length
const selectedCollegeLabel = computed(() => collegeMap[userState.college] || '未选择学院')
const answeredCount = computed(() => quizQuestions.reduce((count, q) => count + (userState.answers[q.id] ? 1 : 0), 0))
const remainingCount = computed(() => totalQuestions - answeredCount.value)
const isAllAnswered = computed(() => answeredCount.value === totalQuestions)
const quizProgressPercent = computed(() => Math.round((answeredCount.value / totalQuestions) * 100))

const currentQuestion = computed(() => quizQuestions[currentQuestionIndex.value] || null)
const currentAnswer = computed(() => {
  if (!currentQuestion.value) return ''
  return userState.answers[currentQuestion.value.id] || ''
})
const canGoPrev = computed(() => currentQuestionIndex.value > 0)
const canGoNext = computed(() => currentQuestionIndex.value < totalQuestions - 1)
const currentTheme = computed(() => collegeThemeMap[userState.college] || collegeThemeMap.default)

const isMappedResult = computed(() => Boolean(resultCodeMap[finalResultCode.value]))
const finalResultKey = computed(() => resultCodeMap[finalResultCode.value] || FALLBACK_RESULT_KEY)
const resultData = computed(() => quizResults[finalResultKey.value] || quizResults[FALLBACK_RESULT_KEY])
const posterMainTitle = computed(() => finalResultKey.value || finalResultCode.value || FALLBACK_RESULT_KEY)

const resultScoreCards = computed(() => {
  const score = finalDimensionScores.value
  if (!score) return []

  const toCard = (label, left, right, leftScore, rightScore, winner) => {
    const total = leftScore + rightScore
    return {
      label,
      left,
      right,
      leftScore,
      rightScore,
      winner,
      leftRatio: total === 0 ? 50 : Math.round((leftScore / total) * 100)
    }
  }

  return [
    toCard('能量场', 'N', 'M', score.energyField.N, score.energyField.M, score.energyWinner),
    toCard('精神状态', 'G', 'D', score.mentalState.G, score.mentalState.D, score.mentalWinner),
    toCard('抗压防御', 'T', 'C', score.stressResistance.T, score.stressResistance.C, score.stressWinner),
    toCard('行动力', 'J', 'B', score.actionDrive.J, score.actionDrive.B, score.actionWinner)
  ]
})

const sanitizeAnswers = (rawAnswers) => {
  const cleaned = {}
  for (const question of quizQuestions) {
    const rawValue = rawAnswers?.[question.id] ?? rawAnswers?.[String(question.id)]
    if (VALID_OPTION_VALUES.has(rawValue)) {
      cleaned[question.id] = rawValue
    }
  }
  return cleaned
}

const jumpToFirstUnanswered = () => {
  const firstUnansweredIndex = quizQuestions.findIndex((q) => !userState.answers[q.id])
  currentQuestionIndex.value = firstUnansweredIndex === -1 ? 0 : firstUnansweredIndex
}

const pickDimensionWinner = (aCode, aScore, bCode, bScore, questionIds) => {
  if (aScore > bScore) return aCode
  if (bScore > aScore) return bCode

  // 平票规则：优先取该维度最后一题的作答，仍取不到时默认左侧字母。
  for (let i = questionIds.length - 1; i >= 0; i--) {
    const answer = userState.answers[questionIds[i]]
    if (answer === aCode || answer === bCode) return answer
  }
  return aCode
}

const calculateResult = () => {
  if (!isAllAnswered.value) return

  const score = {
    energyField: { N: 0, M: 0 },
    mentalState: { G: 0, D: 0 },
    stressResistance: { T: 0, C: 0 },
    actionDrive: { J: 0, B: 0 }
  }

  for (let questionId = 1; questionId <= totalQuestions; questionId++) {
    const answer = userState.answers[questionId]
    if (!answer) continue

    if (questionId >= 1 && questionId <= 4 && (answer === 'N' || answer === 'M')) {
      score.energyField[answer]++
    } else if (questionId >= 5 && questionId <= 8 && (answer === 'G' || answer === 'D')) {
      score.mentalState[answer]++
    } else if (questionId >= 9 && questionId <= 12 && (answer === 'T' || answer === 'C')) {
      score.stressResistance[answer]++
    } else if (questionId >= 13 && questionId <= 16 && (answer === 'J' || answer === 'B')) {
      score.actionDrive[answer]++
    }
  }

  const energyWinner = pickDimensionWinner('N', score.energyField.N, 'M', score.energyField.M, [1, 2, 3, 4])
  const mentalWinner = pickDimensionWinner('G', score.mentalState.G, 'D', score.mentalState.D, [5, 6, 7, 8])
  const stressWinner = pickDimensionWinner('T', score.stressResistance.T, 'C', score.stressResistance.C, [9, 10, 11, 12])
  const actionWinner = pickDimensionWinner('J', score.actionDrive.J, 'B', score.actionDrive.B, [13, 14, 15, 16])

  finalDimensionScores.value = {
    ...score,
    energyWinner,
    mentalWinner,
    stressWinner,
    actionWinner
  }

  finalResultCode.value = [energyWinner, mentalWinner, stressWinner, actionWinner].join('')
  currentStep.value = PAGE_STATE.RESULT
}

const startQuiz = () => {
  if (!userState.college) return
  jumpToFirstUnanswered()
  currentStep.value = PAGE_STATE.QUIZ
}

const selectAnswer = (questionId, value) => {
  userState.answers[questionId] = value

  if (currentStep.value !== PAGE_STATE.QUIZ) return
  if (currentQuestion.value?.id !== questionId) return
  if (!canGoNext.value) return

  const answeredQuestionId = questionId
  window.setTimeout(() => {
    if (currentStep.value !== PAGE_STATE.QUIZ) return
    if (currentQuestion.value?.id !== answeredQuestionId) return
    if (!canGoNext.value) return

    currentQuestionIndex.value++
  }, AUTO_NEXT_DELAY_MS)
}

const goPrevQuestion = () => {
  if (!canGoPrev.value) return
  currentQuestionIndex.value--
}

const goNextQuestion = () => {
  if (!canGoNext.value) return
  currentQuestionIndex.value++
}

const submitQuiz = () => {
  if (!isAllAnswered.value) return
  calculateResult()
}

const restartQuiz = () => {
  userState.answers = {}
  finalResultCode.value = ''
  finalDimensionScores.value = null
  posterImageBase64.value = ''
  posterError.value = ''
  currentQuestionIndex.value = 0
  currentStep.value = PAGE_STATE.QUIZ
}

const withTimeout = (promise, timeoutMs) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('poster_timeout')), timeoutMs)

    promise
      .then((value) => {
        clearTimeout(timer)
        resolve(value)
      })
      .catch((error) => {
        clearTimeout(timer)
        reject(error)
      })
  })

const generatePoster = async () => {
  if (!posterNode.value || !resultData.value) return false

  isGeneratingPoster.value = true
  posterError.value = ''

  try {
    for (let attempt = 0; attempt <= POSTER_RETRY_TIMES; attempt++) {
      try {
        await nextTick()

        const canvas = await withTimeout(
          html2canvas(posterNode.value, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff'
          }),
          POSTER_TIMEOUT_MS
        )

        posterImageBase64.value = canvas.toDataURL('image/png')
        return true
      } catch (error) {
        if (attempt === POSTER_RETRY_TIMES) {
          throw error
        }
      }
    }

    return false
  } catch (error) {
    posterError.value = '海报生成失败，请点击“重新生成海报”。'
    console.error('生成海报失败:', error)
    return false
  } finally {
    isGeneratingPoster.value = false
  }
}

const downloadPoster = async () => {
  if (!posterImageBase64.value) {
    const generated = await generatePoster()
    if (!generated) return
  }

  const fileName = `${selectedCollegeLabel.value}-${finalResultKey.value}-鉴定海报.png`
  const link = document.createElement('a')
  link.href = posterImageBase64.value
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

const shareResult = async () => {
  const shareTitle = `我的精神状态鉴定：${finalResultKey.value}`
  const shareText = `${selectedCollegeLabel.value}的我测出了 ${finalResultKey.value}（${resultData.value?.title || '神秘人格'}）。来测测你是啥物种！`
  const shareUrl = window.location.href

  shareFeedback.value = ''

  try {
    if (navigator.share) {
      await navigator.share({
        title: shareTitle,
        text: shareText,
        url: shareUrl
      })
      shareFeedback.value = '已调起系统分享面板。'
      return
    }

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(`${shareText} ${shareUrl}`)
      shareFeedback.value = '已复制分享文案，快发给你的室友。'
      return
    }

    shareFeedback.value = '当前浏览器不支持自动分享，请手动复制链接。'
  } catch (error) {
    if (error?.name === 'AbortError') {
      shareFeedback.value = '你取消了分享。'
    } else {
      shareFeedback.value = '分享失败，请稍后重试。'
      console.error('分享失败:', error)
    }
  }
}

watch(
  () => currentStep.value,
  async (step) => {
    if (step !== PAGE_STATE.RESULT) {
      shareFeedback.value = ''
    }

    if (step === PAGE_STATE.RESULT) {
      await nextTick()
      await generatePoster()
    }
  }
)

onMounted(() => {
  // 强制每次从首页开始，避免旧缓存导致直接跳题页。
  localStorage.removeItem('sdu_mbti_h5_state_v2')

  currentStep.value = PAGE_STATE.HOME
  currentQuestionIndex.value = 0
  userState.college = ''
  userState.answers = {}

  finalResultCode.value = ''
  finalDimensionScores.value = null
  posterImageBase64.value = ''
  posterError.value = ''
  shareFeedback.value = ''
})
</script>

<template>
  <div v-if="currentStep === PAGE_STATE.HOME" class="app-shell min-h-screen flex items-center justify-center px-5 py-10">
    <div class="bg-orb orb-a" />
    <div class="bg-orb orb-b" />

    <div class="content-wrap w-full max-w-md">
      <section class="glass-card hero-card reveal reveal-1 p-7 sm:p-8">
        <div class="text-center">
          <p class="eyebrow">SDU PERSONALITY LAB</p>
          <h1 class="title-main text-4xl sm:text-5xl">
            鳌山卫精神状态<br />大鉴定
          </h1>
          <p class="subtitle-main mt-4 text-base sm:text-lg">
            妖风肆虐，你到底是个什么物种？
          </p>

          <div class="mt-6 flex items-center justify-center gap-2">
            <span class="meta-pill">16道题</span>
            <span class="meta-pill">约3分钟</span>
            <span class="meta-pill">即时海报</span>
          </div>
        </div>

        <div class="mt-8">
          <label for="college-select" class="mb-3 block text-sm font-semibold tracking-wide text-slate-600">
            选择你的学院
          </label>
          <select id="college-select" v-model="userState.college" class="glass-input">
            <option value="">-- 选择学院 --</option>
            <option value="cs">计算机学院</option>
            <option value="cybersecurity">网安学院</option>
            <option value="governance">政管学院</option>
            <option value="law">法学院</option>
            <option value="business">商学院</option>
            <option value="engineering">工程学院</option>
            <option value="science">理学院</option>
            <option value="humanities">文学院</option>
            <option value="other">其他学院</option>
          </select>
        </div>

        <button
          @click="startQuiz"
          :disabled="!userState.college"
          class="cta-primary mt-8 w-full py-4 text-lg font-semibold"
          :class="!userState.college ? 'is-disabled' : ''"
        >
          开始鉴定
        </button>

        <p v-if="!userState.college" class="hint-text mt-4 text-center text-sm">
          请先选择学院，再开始测试
        </p>
      </section>
    </div>
  </div>

  <div v-else-if="currentStep === PAGE_STATE.QUIZ" class="app-shell min-h-screen pb-32">
    <div class="bg-orb orb-a" />
    <div class="bg-orb orb-c" />

    <div class="content-wrap mx-auto w-full max-w-md px-4 pt-6">
      <section class="glass-card reveal reveal-1 p-4">
        <div class="flex items-center justify-between text-sm font-semibold text-slate-600">
          <p>第 {{ currentQuestion?.id || 1 }}/{{ totalQuestions }} 题</p>
          <p class="text-sky-700">已答 {{ answeredCount }}/{{ totalQuestions }}</p>
        </div>

        <div class="mt-3 h-2 overflow-hidden rounded-full bg-slate-200/80">
          <div class="h-2 rounded-full bg-gradient-to-r from-sky-400 to-blue-500 transition-all duration-300" :style="{ width: `${quizProgressPercent}%` }" />
        </div>
      </section>

      <article v-if="currentQuestion" class="glass-card reveal reveal-2 mt-4 p-5">
        <h3 class="text-lg font-bold leading-relaxed text-slate-900">
          {{ currentQuestion.id }}. {{ currentQuestion.title }}
        </h3>

        <div class="mt-4 grid grid-cols-1 gap-3">
          <button
            v-for="option in currentQuestion.options"
            :key="option.value"
            type="button"
            @click="selectAnswer(currentQuestion.id, option.value)"
            class="option-btn"
            :class="currentAnswer === option.value ? 'option-btn--active' : 'option-btn--idle'"
          >
            {{ option.text }}
          </button>
        </div>
      </article>

      <div class="mt-4 grid grid-cols-2 gap-3 reveal reveal-3">
        <button type="button" @click="goPrevQuestion" :disabled="!canGoPrev" class="cta-ghost py-3" :class="!canGoPrev ? 'is-disabled' : ''">
          上一题
        </button>
        <button type="button" @click="goNextQuestion" :disabled="!canGoNext" class="cta-ghost py-3" :class="!canGoNext ? 'is-disabled' : ''">
          下一题
        </button>
      </div>

      <p class="mt-3 text-center text-xs font-medium tracking-wide text-slate-500">
        已开启自动下一题模式
      </p>
    </div>

    <div class="glass-bottom-bar fixed bottom-0 left-0 right-0 px-4 py-4">
      <div class="mx-auto w-full max-w-md">
        <button
          type="button"
          @click="submitQuiz"
          :disabled="!isAllAnswered"
          class="cta-primary w-full py-4 text-base font-semibold"
          :class="!isAllAnswered ? 'is-disabled' : ''"
        >
          {{ isAllAnswered ? '生成我的鉴定报告' : `还有 ${remainingCount} 题没做完哦` }}
        </button>
      </div>
    </div>
  </div>

  <div v-else-if="currentStep === PAGE_STATE.RESULT" class="app-shell min-h-screen px-4 py-8">
    <div class="bg-orb orb-b" />
    <div class="bg-orb orb-c" />

    <div class="content-wrap mx-auto w-full max-w-md">
      <header class="glass-card reveal reveal-1 p-5 text-center">
        <p class="eyebrow">YOUR REPORT</p>
        <h2 class="text-2xl font-bold text-slate-900">你的专属鉴定报告</h2>
        <p class="mt-1 text-sm font-semibold text-slate-600">维度码：{{ finalResultCode }} · 类型：{{ finalResultKey }}</p>
        <p v-if="!isMappedResult" class="mt-2 text-xs font-semibold text-rose-600">结果码未命中字典，已使用兜底类型。</p>
      </header>

      <section v-if="resultScoreCards.length" class="glass-card reveal reveal-2 mt-4 p-4">
        <h3 class="text-base font-bold text-slate-900">四维得分明细</h3>

        <div class="mt-3 space-y-3">
          <div v-for="item in resultScoreCards" :key="item.label">
            <div class="mb-1 flex items-center justify-between text-xs font-semibold text-slate-600">
              <span>{{ item.left }} {{ item.leftScore }}</span>
              <span>{{ item.label }} · 判定 {{ item.winner }}</span>
              <span>{{ item.right }} {{ item.rightScore }}</span>
            </div>

            <div class="h-2 overflow-hidden rounded-full bg-slate-200/85">
              <div class="h-2 rounded-full bg-gradient-to-r from-slate-600 to-slate-800" :style="{ width: `${item.leftRatio}%` }" />
            </div>
          </div>
        </div>
      </section>

      <section class="glass-card reveal reveal-3 mt-4 overflow-hidden p-2">
        <img v-if="posterImageBase64" :src="posterImageBase64" alt="人格测试海报" class="block h-auto w-full rounded-2xl" />
        <div v-else class="loading-panel flex h-80 flex-col items-center justify-center rounded-2xl px-6 text-center text-sm font-semibold text-slate-600">
          <span class="loading-ring" />
          {{ isGeneratingPoster ? '正在生成海报...' : '海报准备中，请稍候...' }}
        </div>
      </section>

      <p class="mt-4 text-center text-sm font-semibold text-slate-600">长按上方图片保存到手机</p>
      <p v-if="posterError" class="mt-2 text-center text-sm font-semibold text-rose-600">{{ posterError }}</p>

      <div class="mt-4 grid grid-cols-2 gap-3">
        <button type="button" @click="generatePoster" :disabled="isGeneratingPoster" class="cta-primary py-3" :class="isGeneratingPoster ? 'is-disabled' : ''">
          {{ isGeneratingPoster ? '生成中...' : '重新生成海报' }}
        </button>
        <button type="button" @click="downloadPoster" :disabled="isGeneratingPoster" class="cta-ghost py-3" :class="isGeneratingPoster ? 'is-disabled' : ''">
          下载海报
        </button>
      </div>

      <div class="mt-3 grid grid-cols-2 gap-3">
        <button
          type="button"
          @click="shareResult"
          :disabled="isGeneratingPoster"
          class="cta-accent py-3"
          :style="{ backgroundColor: currentTheme.actionColor }"
          :class="isGeneratingPoster ? 'is-disabled' : ''"
        >
          分享结果
        </button>
        <button type="button" @click="restartQuiz" class="cta-soft py-3">再测一次</button>
      </div>

      <p v-if="shareFeedback" class="mt-3 text-center text-sm font-semibold text-slate-600">{{ shareFeedback }}</p>
    </div>

    <div class="absolute -left-[9999px] top-0">
      <div
        ref="posterNode"
        class="poster-canvas relative w-[390px] overflow-hidden rounded-2xl border-4 p-8 text-black"
        :style="{ backgroundImage: currentTheme.posterGradient, borderColor: currentTheme.borderColor }"
      >
        <div class="poster-blob poster-blob-a" />
        <div class="poster-blob poster-blob-b" />

        <div class="relative z-10">
          <p class="text-base font-black">{{ selectedCollegeLabel }} 专属鉴定报告</p>

          <h1 class="mt-6 w-full break-words text-center text-6xl font-black uppercase leading-none tracking-tight">
            {{ posterMainTitle }}
          </h1>

          <div style="margin-top: 24px; display: flex; flex-wrap: wrap; justify-content: center; gap: 10px 14px;">
            <span
              v-for="(tag, idx) in (resultData?.tags || []).slice(0, 3)"
              :key="`${idx}-${tag}`"
              :style="{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: currentTheme.tagBg,
                color: currentTheme.tagColor,
                minHeight: '38px',
                maxWidth: '100%',
                padding: '6px 18px',
                borderRadius: '999px'
              }"
            >
              <span style="display: block; white-space: nowrap; font-size: 14px; font-weight: 700; line-height: 1.25;">
                {{ tag }}
              </span>
            </span>
          </div>

          <p class="mt-8 text-base font-semibold leading-relaxed">
            {{ resultData?.description || '结果描述生成中...' }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
:global(:root) {
  --pf-bg-1: #f8fafc;
  --pf-bg-2: #eef2ff;
  --pf-surface: rgba(255, 255, 255, 0.68);
  --pf-surface-strong: rgba(255, 255, 255, 0.8);
  --pf-border: rgba(255, 255, 255, 0.8);
  --pf-text: #0f172a;
  --pf-text-soft: #64748b;
  --pf-primary-1: #60a5fa;
  --pf-primary-2: #5b94f7;
  --pf-primary-3: #7ab2ff;
  --pf-shadow-lg: 0 22px 44px rgba(15, 23, 42, 0.12);
  --pf-shadow-sm: 0 8px 18px rgba(15, 23, 42, 0.08);
  --pf-ease: cubic-bezier(0.22, 0.61, 0.36, 1);
}

.app-shell {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  background:
    radial-gradient(circle at 12% 6%, rgba(191, 219, 254, 0.5) 0%, rgba(191, 219, 254, 0) 48%),
    radial-gradient(circle at 88% 14%, rgba(251, 243, 255, 0.62) 0%, rgba(251, 243, 255, 0) 52%),
    linear-gradient(180deg, var(--pf-bg-1) 0%, var(--pf-bg-2) 100%);
}

.content-wrap {
  position: relative;
  z-index: 2;
}

.bg-orb {
  position: absolute;
  z-index: 1;
  border-radius: 999px;
  filter: blur(42px);
  opacity: 0.72;
}

.orb-a {
  top: -56px;
  left: -44px;
  width: 220px;
  height: 220px;
  background: rgba(147, 197, 253, 0.56);
}

.orb-b {
  top: 40px;
  right: -64px;
  width: 240px;
  height: 240px;
  background: rgba(251, 207, 232, 0.58);
}

.orb-c {
  bottom: -80px;
  left: 35%;
  width: 240px;
  height: 240px;
  background: rgba(186, 230, 253, 0.52);
}

.glass-card {
  border: 1px solid var(--pf-border);
  border-radius: 24px;
  background: var(--pf-surface);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  box-shadow:
    var(--pf-shadow-lg),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);
}

.glass-bottom-bar {
  border-top: 1px solid rgba(148, 163, 184, 0.25);
  background: rgba(248, 250, 252, 0.82);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

.loading-panel {
  background: linear-gradient(150deg, rgba(255, 255, 255, 0.82) 0%, rgba(241, 245, 249, 0.9) 100%);
}

.loading-ring {
  width: 28px;
  height: 28px;
  margin-bottom: 10px;
  border-radius: 999px;
  border: 2px solid rgba(148, 163, 184, 0.35);
  border-top-color: rgba(59, 130, 246, 0.8);
  animation: spin 760ms linear infinite;
}

.hero-card {
  border-radius: 28px;
  background: linear-gradient(160deg, rgba(255, 255, 255, 0.82) 0%, rgba(255, 255, 255, 0.64) 100%);
}

.meta-pill {
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.72);
  color: #475569;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  padding: 6px 10px;
}

.eyebrow {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--pf-text-soft);
}

.title-main {
  margin-top: 10px;
  font-weight: 800;
  line-height: 1.06;
  letter-spacing: -0.03em;
  color: var(--pf-text);
}

.subtitle-main {
  color: #51627a;
  line-height: 1.65;
  font-weight: 500;
}

.hint-text {
  color: var(--pf-text-soft);
}

.glass-input {
  width: 100%;
  appearance: none;
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 16px;
  background: var(--pf-surface-strong);
  color: var(--pf-text);
  font-size: 15px;
  font-weight: 600;
  padding: 13px 14px;
  transition: all 0.25s var(--pf-ease);
}

.glass-input:focus {
  outline: none;
  border-color: rgba(148, 163, 184, 0.78);
  box-shadow: 0 0 0 4px rgba(148, 163, 184, 0.18);
}

.option-btn {
  width: 100%;
  border-radius: 18px;
  border: 1px solid transparent;
  padding: 15px 14px;
  text-align: left;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.55;
  transition: all 0.25s var(--pf-ease);
}

.option-btn--idle {
  border-color: rgba(148, 163, 184, 0.33);
  background: rgba(255, 255, 255, 0.72);
  color: #1e293b;
}

.option-btn--active {
  border-color: rgba(96, 165, 250, 0.65);
  background: linear-gradient(140deg, #dbeafe 0%, #e8edff 100%);
  color: #1e3a8a;
  box-shadow: 0 10px 22px rgba(96, 165, 250, 0.24);
}

.cta-primary,
.cta-ghost,
.cta-accent,
.cta-soft {
  border-radius: 16px;
  font-size: 15px;
  font-weight: 700;
  transition: all 0.24s var(--pf-ease);
}

.cta-primary {
  border: 1px solid rgba(59, 130, 246, 0.25);
  color: #ffffff;
  background: linear-gradient(135deg, var(--pf-primary-1) 0%, var(--pf-primary-2) 45%, var(--pf-primary-3) 100%);
  box-shadow: 0 14px 28px rgba(59, 130, 246, 0.28);
}

.cta-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 16px 32px rgba(59, 130, 246, 0.34);
}

.cta-primary:active,
.cta-ghost:active,
.cta-accent:active,
.cta-soft:active,
.option-btn:active {
  transform: scale(0.985);
}

.cta-ghost {
  border: 1px solid rgba(148, 163, 184, 0.38);
  color: #1e293b;
  background: rgba(255, 255, 255, 0.72);
}

.cta-ghost:hover,
.cta-soft:hover {
  background: rgba(255, 255, 255, 0.9);
}

.cta-accent {
  border: 1px solid rgba(255, 255, 255, 0.28);
  color: #ffffff;
  box-shadow: 0 12px 24px rgba(15, 23, 42, 0.2);
}

.cta-soft {
  border: 1px solid rgba(148, 163, 184, 0.38);
  color: #0f172a;
  background: rgba(255, 255, 255, 0.78);
}

.is-disabled {
  opacity: 0.46;
  box-shadow: none;
  pointer-events: none;
}

.poster-canvas {
  box-shadow: var(--pf-shadow-sm);
}

.poster-blob {
  position: absolute;
  border-radius: 999px;
  filter: blur(22px);
  opacity: 0.45;
}

.poster-blob-a {
  top: -32px;
  right: -12px;
  width: 120px;
  height: 120px;
  background: rgba(255, 255, 255, 0.5);
}

.poster-blob-b {
  bottom: -26px;
  left: -20px;
  width: 140px;
  height: 140px;
  background: rgba(255, 255, 255, 0.38);
}

.reveal {
  animation: cardEnter 560ms var(--pf-ease) both;
}

.reveal-1 {
  animation-delay: 0ms;
}

.reveal-2 {
  animation-delay: 70ms;
}

.reveal-3 {
  animation-delay: 130ms;
}

@keyframes cardEnter {
  from {
    opacity: 0;
    transform: translateY(14px) scale(0.99);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

@supports not ((backdrop-filter: blur(2px)) or (-webkit-backdrop-filter: blur(2px))) {
  .glass-card,
  .glass-bottom-bar {
    background: rgba(255, 255, 255, 0.96);
  }
}

@media (max-width: 390px) {
  .bg-orb {
    filter: blur(28px);
    opacity: 0.6;
  }

  .glass-card {
    border-radius: 20px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .reveal {
    animation: none;
  }

  .loading-ring {
    animation: none;
    border-top-color: rgba(148, 163, 184, 0.35);
  }

  .bg-orb {
    display: none;
  }

  .cta-primary,
  .cta-ghost,
  .cta-accent,
  .cta-soft,
  .option-btn {
    transition: none;
  }
}

:global(body) {
  font-family:
    -apple-system,
    BlinkMacSystemFont,
    'SF Pro Text',
    'SF Pro Display',
    'PingFang SC',
    'Hiragino Sans GB',
    'Segoe UI',
    sans-serif;
}
</style>