<script setup>
import { ref, reactive, computed, nextTick, watch, onMounted } from 'vue'
import html2canvas from 'html2canvas'
import { quizQuestions, quizResults } from '../../src/data/quizData.js'
import fallbackResultImage from './assets/hero.png'

const PAGE_STATE = {
  HOME: 'HOME',
  QUIZ: 'QUIZ',
  RESULT: 'RESULT'
}

const POSTER_TIMEOUT_MS = 12000
const POSTER_RETRY_TIMES = 1
const AUTO_NEXT_DELAY_MS = 140
const FALLBACK_RESULT_KEY = 'WEIRDO'
const ASSET_BASE_URL = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/')
const RESULT_IMAGE_BASE_DIR = `${ASSET_BASE_URL}personas`

const currentStep = ref(PAGE_STATE.HOME)
const currentQuestionIndex = ref(0)

const userState = reactive({
  answers: {}
})

const finalResultCode = ref('')
const finalDimensionScores = ref(null)
const resultGeneratedAt = ref(null)

const posterNode = ref(null)
const posterImageBase64 = ref('')
const isGeneratingPoster = ref(false)
const posterError = ref('')
const shareFeedback = ref('')
const useFallbackResultImage = ref(false)

const resultCodeMap = {
  ESTJ: 'CEO',
  ESTP: 'MONKEY',
  ESFJ: 'MOM',
  ESFP: 'FLOWER',
  ENTJ: 'SCAMMER',
  ENTP: 'TROLL',
  ENFJ: 'SAINT',
  ENFP: 'PUPPY',
  ISTJ: 'BOT',
  ISTP: 'GHOST',
  ISFJ: 'DOORMAT',
  ISFP: 'CUTE',
  INTJ: 'HATER',
  INTP: 'WEIRDO',
  INFJ: 'MONK',
  INFP: 'WATER'
}

const totalQuestions = quizQuestions.length
const answeredCount = computed(() => quizQuestions.reduce((count, q) => count + (userState.answers[q.id] ? 1 : 0), 0))
const remainingCount = computed(() => totalQuestions - answeredCount.value)
const isAllAnswered = computed(() => answeredCount.value === totalQuestions)
const quizProgressPercent = computed(() => Math.round((answeredCount.value / totalQuestions) * 100))

const currentQuestion = computed(() => quizQuestions[currentQuestionIndex.value] || null)
const currentAnswer = computed(() => {
  if (!currentQuestion.value) return null
  return userState.answers[currentQuestion.value.id] || null
})
const canGoPrev = computed(() => currentQuestionIndex.value > 0)
const canGoNext = computed(() => currentQuestionIndex.value < totalQuestions - 1)

// 计算结果的核心函数，遍历用户的每个回答，根据题目所属维度和选项权重累加分数，最后根据得分情况确定每个维度的胜出类型。
const isMappedResult = computed(() => Boolean(resultCodeMap[finalResultCode.value]))
const finalResultKey = computed(() => resultCodeMap[finalResultCode.value] || FALLBACK_RESULT_KEY)
const finalResultData = computed(() => quizResults[finalResultKey.value] || quizResults[FALLBACK_RESULT_KEY])
const posterMainTitle = computed(() => finalResultKey.value || finalResultCode.value || FALLBACK_RESULT_KEY)
const resultImageSrc = computed(() => {
  const imageName = finalResultData.value?.image
  if (!imageName || useFallbackResultImage.value) return fallbackResultImage
  return `${RESULT_IMAGE_BASE_DIR}/${encodeURIComponent(imageName)}`
})

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
    toCard('能量场', 'E', 'I', score.energyField.E, score.energyField.I, score.energyWinner),
    toCard('精神状态', 'S', 'N', score.informationStyle.S, score.informationStyle.N, score.informationWinner),
    toCard('防御力', 'T', 'F', score.decisionStyle.T, score.decisionStyle.F, score.decisionWinner),
    toCard('行动力', 'J', 'P', score.actionDrive.J, score.actionDrive.P, score.actionWinner)
  ]
})

const formatDateTime = (date) => {
  if (!date) return '--'

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')

  return `${year}-${month}-${day} ${hour}:${minute}`
}

const generatedAtLabel = computed(() => formatDateTime(resultGeneratedAt.value))
const descriptionHeading = computed(() => `最擅长${finalResultData.value?.title || '自我进化'}的类型`)

const jumpToFirstUnanswered = () => {
  const firstUnansweredIndex = quizQuestions.findIndex((q) => !userState.answers[q.id])
  currentQuestionIndex.value = firstUnansweredIndex === -1 ? 0 : firstUnansweredIndex
}

const pickDimensionWinner = (aCode, aScore, bCode, bScore, questionIds) => {
  if (aScore > bScore) return aCode
  if (bScore > aScore) return bCode

  // 平票规则：优先取该维度最后一题的作答，仍取不到时默认左侧字母。
  for (let i = questionIds.length - 1; i >= 0; i--) {
    const answerTarget = userState.answers[questionIds[i]]?.target
    if (answerTarget === aCode || answerTarget === bCode) return answerTarget
  }
  return aCode
}

// 计算结果的核心函数，遍历用户的每个回答，根据题目所属维度和选项权重累加分数，最后根据得分情况确定每个维度的胜出类型。
const calculateResult = () => {
  if (!isAllAnswered.value) return

  const score = {
    energyField: { E: 0, I: 0 },
    informationStyle: { S: 0, N: 0 },
    decisionStyle: { T: 0, F: 0 },
    actionDrive: { J: 0, P: 0 }
  }

  for (let questionId = 1; questionId <= totalQuestions; questionId++) {
    const answer = userState.answers[questionId]
    const answerTarget = answer?.target
    const answerWeight = answer?.weight === 2 ? 2 : answer?.weight === 1 ? 1 : 0
    if (!answerTarget || !answerWeight) continue

    if (questionId >= 1 && questionId <= 4 && (answerTarget === 'E' || answerTarget === 'I')) {
      score.energyField[answerTarget] += answerWeight
    } else if (questionId >= 5 && questionId <= 8 && (answerTarget === 'S' || answerTarget === 'N')) {
      score.informationStyle[answerTarget] += answerWeight
    } else if (questionId >= 9 && questionId <= 12 && (answerTarget === 'T' || answerTarget === 'F')) {
      score.decisionStyle[answerTarget] += answerWeight
    } else if (questionId >= 13 && questionId <= 16 && (answerTarget === 'J' || answerTarget === 'P')) {
      score.actionDrive[answerTarget] += answerWeight
    }
  }

  const energyWinner = pickDimensionWinner('E', score.energyField.E, 'I', score.energyField.I, [1, 2, 3, 4])
  const informationWinner = pickDimensionWinner('S', score.informationStyle.S, 'N', score.informationStyle.N, [5, 6, 7, 8])
  const decisionWinner = pickDimensionWinner('T', score.decisionStyle.T, 'F', score.decisionStyle.F, [9, 10, 11, 12])
  const actionWinner = pickDimensionWinner('J', score.actionDrive.J, 'P', score.actionDrive.P, [13, 14, 15, 16])

  finalDimensionScores.value = {
    ...score,
    energyWinner,
    informationWinner,
    decisionWinner,
    actionWinner
  }

  // 将四个维度的胜出类型字母组合成最终结果码，例如 "ESTJ"。
  finalResultCode.value = [energyWinner, informationWinner, decisionWinner, actionWinner].join('')
  resultGeneratedAt.value = new Date()
  currentStep.value = PAGE_STATE.RESULT
}

const startQuiz = () => {
  jumpToFirstUnanswered()
  currentStep.value = PAGE_STATE.QUIZ
}

const selectAnswer = (questionId, option, optionIndex) => {
  const normalizedWeight = option?.weight === 2 ? 2 : option?.weight === 1 ? 1 : 0
  if (!option?.target || !normalizedWeight) return

  userState.answers[questionId] = {
    target: option.target,
    weight: normalizedWeight,
    optionIndex
  }

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
  resultGeneratedAt.value = null
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

  // 生成海报的函数，使用 html2canvas 将指定 DOM 节点渲染成画布，并转换为 Base64 图片数据。函数内包含重试机制和错误处理，以提高生成成功率和用户体验。
const generatePoster = async () => {
  if (!posterNode.value || !finalResultData.value) return false

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

  const fileName = `${finalResultKey.value}-鉴定海报.png`
  const link = document.createElement('a')
  link.href = posterImageBase64.value
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

const shareResult = async () => {
  const shareTitle = `我的精神状态鉴定：${finalResultKey.value}`
  const shareText = `我测出了 ${finalResultKey.value}（${finalResultData.value?.title || '神秘人格'}）。来测测你是啥物种！`
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

const handleResultImageError = () => {
  if (!useFallbackResultImage.value) {
    useFallbackResultImage.value = true
  }
}

watch(
  () => currentStep.value,
  async (step) => {
    if (step !== PAGE_STATE.RESULT) {
      shareFeedback.value = ''
    }

    if (step === PAGE_STATE.RESULT) {
      posterImageBase64.value = ''
      await nextTick()
      await generatePoster()
    }
  }
)

watch(
  () => finalResultData.value?.image,
  () => {
    useFallbackResultImage.value = false
  }
)

onMounted(() => {
  // 强制每次从首页开始，避免旧缓存导致直接跳题页。
  localStorage.removeItem('sdu_mbti_h5_state_v2')

  currentStep.value = PAGE_STATE.HOME
  currentQuestionIndex.value = 0
  userState.answers = {}

  finalResultCode.value = ''
  finalDimensionScores.value = null
  resultGeneratedAt.value = null
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

        <button
          @click="startQuiz"
          class="cta-primary mt-8 w-full py-4 text-lg font-semibold"
        >
          开始鉴定
        </button>
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
            v-for="(option, optionIndex) in currentQuestion.options"
            :key="`${currentQuestion.id}-${optionIndex}`"
            type="button"
            @click="selectAnswer(currentQuestion.id, option, optionIndex)"
            class="option-btn"
            :class="currentAnswer?.optionIndex === optionIndex ? 'option-btn--active' : 'option-btn--idle'"
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

  <div
    v-else-if="currentStep === PAGE_STATE.RESULT"
    class="relative min-h-screen overflow-hidden bg-slate-50 py-8"
  >
    <div
      class="pointer-events-none absolute -left-24 -top-28 h-[28rem] w-[28rem] rounded-full opacity-10 blur-[100px]"
      :style="{ backgroundColor: finalResultData?.themeColor }"
    />
    <div
      class="pointer-events-none absolute -bottom-28 -right-20 h-[30rem] w-[30rem] rounded-full opacity-10 blur-[100px]"
      :style="{ backgroundColor: finalResultData?.themeColor }"
    />

    <div class="relative z-10 mx-auto w-full max-w-3xl">
      <header class="px-4 text-center">
        <p class="text-base font-semibold text-gray-800">你的专属鉴定报告已生成</p>
        <p class="mt-1 text-xs text-gray-400">生成于：{{ generatedAtLabel }}</p>
      </header>

      <section class="mx-4 mt-5 rounded-3xl bg-white p-6 shadow-lg">
        <div class="flex items-center gap-5">
          <div class="w-2/5">
            <img
              :src="resultImageSrc"
              :alt="`${finalResultData?.title || finalResultCode} 人格形象`"
              class="h-auto w-full object-contain mix-blend-multiply"
              @error="handleResultImageError"
            />
          </div>

          <div class="w-3/5">
            <p class="text-xs text-gray-500">你的测试类型</p>
            <h2 class="mt-1 text-5xl font-black leading-none text-gray-900">{{ finalResultCode }}</h2>
            <p class="mt-2 text-xl font-bold" :style="{ color: finalResultData?.themeColor }">{{ finalResultData?.title }}</p>
            <p v-if="!isMappedResult" class="mt-2 text-xs font-semibold text-rose-600">结果码未命中字典，已使用兜底类型。</p>
          </div>
        </div>

        <section v-if="resultScoreCards.length" class="mt-8">
          <h3 class="mb-4 text-lg font-bold text-gray-900">类型数据</h3>

          <div class="space-y-4">
            <div v-for="item in resultScoreCards" :key="item.label">
              <div class="flex justify-between text-xs font-bold text-slate-500">
                <span>{{ item.left }} {{ item.leftRatio }}%</span>
                <span>{{ 100 - item.leftRatio }}% {{ item.right }}</span>
              </div>

              <div class="mt-2 h-1.5 rounded-full" :style="{ backgroundColor: finalResultData?.themeColor + '20' }">
                <div
                  class="h-1.5 rounded-full"
                  :style="{ backgroundColor: finalResultData?.themeColor, width: `${item.leftRatio}%` }"
                />
              </div>
            </div>
          </div>
        </section>

        <section class="mt-8 border-t border-gray-100 pt-6">
          <p class="text-sm font-semibold" :style="{ color: finalResultData?.themeColor }">{{ descriptionHeading }}</p>
          <p class="mt-3 text-justify text-sm leading-relaxed text-gray-700">
            {{ finalResultData?.description || '结果描述生成中...' }}
          </p>
        </section>
      </section>

      <div class="mx-4 mt-4">
        <p class="text-center text-sm font-semibold text-gray-500">
          {{ isGeneratingPoster ? '海报生成中，请稍候...' : '海报已准备好，可直接下载或分享' }}
        </p>
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
            :style="{ backgroundColor: finalResultData?.themeColor }"
            :class="isGeneratingPoster ? 'is-disabled' : ''"
          >
            分享结果
          </button>
          <button type="button" @click="restartQuiz" class="cta-soft py-3">再测一次</button>
        </div>

        <p v-if="shareFeedback" class="mt-3 text-center text-sm font-semibold text-gray-500">{{ shareFeedback }}</p>
      </div>
    </div>

    <div class="absolute -left-[9999px] top-0">
      <div ref="posterNode" class="w-[390px] bg-gray-50 p-4">
        <header class="text-center">
          <p class="text-[15px] font-semibold text-gray-800">你的专属鉴定报告已生成</p>
          <p class="mt-1 text-[10px] text-gray-400">生成于：{{ generatedAtLabel }}</p>
        </header>

        <section class="mt-4 rounded-3xl bg-white p-6 shadow-lg">
          <div class="flex items-center gap-4">
            <div class="w-2/5">
              <img
                :src="resultImageSrc"
                :alt="`${posterMainTitle} 人格形象`"
                class="h-auto w-full object-contain mix-blend-multiply"
                @error="handleResultImageError"
              />
            </div>

            <div class="w-3/5">
              <p class="text-[11px] text-gray-500">你的测试类型</p>
              <h1 class="mt-1 text-[48px] font-black leading-none text-gray-900">{{ finalResultCode }}</h1>
              <p class="mt-2 text-[20px] font-bold" :style="{ color: finalResultData?.themeColor }">{{ finalResultData?.title }}</p>
            </div>
          </div>

          <section v-if="resultScoreCards.length" class="mt-8">
            <h3 class="mb-4 text-[19px] font-bold text-gray-900">类型数据</h3>

            <div class="space-y-4">
              <div v-for="item in resultScoreCards" :key="`poster-${item.label}`">
                <div class="flex justify-between text-[12px] text-gray-700">
                  <span>{{ item.left }} {{ item.leftRatio }}%</span>
                  <span>{{ 100 - item.leftRatio }}% {{ item.right }}</span>
                </div>

                <div class="mt-2 h-2 rounded-full bg-gray-200">
                  <div
                    class="h-2 rounded-full"
                    :style="{ backgroundColor: finalResultData?.themeColor, width: `${item.leftRatio}%` }"
                  />
                </div>
              </div>
            </div>
          </section>

          <section class="mt-8 border-t border-gray-100 pt-6">
            <p class="text-[13px] font-semibold" :style="{ color: finalResultData?.themeColor }">{{ descriptionHeading }}</p>
            <p class="mt-3 text-justify text-[13px] leading-relaxed text-gray-700">
              {{ finalResultData?.description || '结果描述生成中...' }}
            </p>
          </section>
        </section>
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