<script setup lang="ts">
import { ref, watch } from "vue";

import type { RejectReason } from "@/lib/api";

const props = defineProps<{
  open: boolean;
  title?: string;
  pending?: boolean;
}>();

const emit = defineEmits<{
  cancel: [];
  confirm: [payload: { reason: RejectReason; notes: string }];
}>();

const REASONS: Array<{ value: RejectReason; label: string; hint: string }> = [
  { value: "INACCURATE", label: "不准确", hint: "事实错误或与原文不符" },
  { value: "IRRELEVANT", label: "不相关", hint: "对我来说没用" },
  { value: "DUPLICATE", label: "已存在", hint: "其他词条已经覆盖" },
  { value: "TRIVIAL", label: "太琐碎", hint: "不值得作为独立词条" },
  { value: "OTHER", label: "其他", hint: "请在备注里说明" },
];

const selected = ref<RejectReason>("INACCURATE");
const notes = ref("");

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      selected.value = "INACCURATE";
      notes.value = "";
    }
  },
);

function submit() {
  emit("confirm", { reason: selected.value, notes: notes.value });
}
</script>

<template>
  <div v-if="open" class="reject-modal__backdrop" @click.self="emit('cancel')">
    <div class="reject-modal" role="dialog" aria-modal="true">
      <div class="reject-modal__head">
        <h3>{{ title || "拒绝原因" }}</h3>
        <p>选一个最贴近的原因。后续会用这些反馈调优 AI 抽取质量。</p>
      </div>

      <div class="reject-modal__reasons">
        <label
          v-for="r in REASONS"
          :key="r.value"
          class="reject-modal__reason"
          :class="{ 'reject-modal__reason--active': selected === r.value }"
        >
          <input v-model="selected" type="radio" :value="r.value" :name="'reject-reason'" />
          <div class="reject-modal__reason-text">
            <span class="reject-modal__reason-label">{{ r.label }}</span>
            <span class="reject-modal__reason-hint">{{ r.hint }}</span>
          </div>
        </label>
      </div>

      <textarea
        v-model="notes"
        class="reject-modal__notes"
        rows="3"
        placeholder="备注（可选）"
        :maxlength="2000"
      ></textarea>

      <div class="reject-modal__actions">
        <button class="button button--ghost" :disabled="pending" @click="emit('cancel')">取消</button>
        <button class="button button--danger" :disabled="pending" @click="submit">
          {{ pending ? "处理中…" : "确认拒绝" }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.reject-modal__backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.32);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
  backdrop-filter: blur(2px);
}

.reject-modal {
  width: 420px;
  max-width: calc(100vw - 32px);
  background: #fff8f1;
  border: 1px solid rgba(95, 64, 28, 0.18);
  border-radius: 18px;
  padding: 22px 24px;
  box-shadow: 0 30px 80px rgba(89, 50, 19, 0.22);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.reject-modal__head h3 {
  margin: 0 0 6px;
  font-family: Georgia, "Times New Roman", serif;
}

.reject-modal__head p {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-soft, #666);
}

.reject-modal__reasons {
  display: grid;
  gap: 6px;
}

.reject-modal__reason {
  display: flex;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid rgba(95, 64, 28, 0.14);
  border-radius: 10px;
  cursor: pointer;
  transition: 120ms ease;
  background: rgba(255, 255, 255, 0.6);
}

.reject-modal__reason:hover {
  border-color: rgba(201, 99, 61, 0.4);
}

.reject-modal__reason--active {
  border-color: rgba(201, 99, 61, 0.6);
  background: rgba(201, 99, 61, 0.08);
}

.reject-modal__reason input {
  margin-top: 4px;
}

.reject-modal__reason-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.reject-modal__reason-label {
  font-weight: 600;
  font-size: 0.92rem;
}

.reject-modal__reason-hint {
  font-size: 0.78rem;
  color: var(--text-soft, #777);
}

.reject-modal__notes {
  width: 100%;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid rgba(95, 64, 28, 0.14);
  background: rgba(255, 255, 255, 0.7);
  resize: vertical;
  font-family: inherit;
  font-size: 0.88rem;
}

.reject-modal__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.button--danger {
  background: #b85a3f;
  color: white;
  border: 1px solid #a04832;
}

.button--danger:hover:not(:disabled) {
  background: #a04832;
}

.button--danger:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
