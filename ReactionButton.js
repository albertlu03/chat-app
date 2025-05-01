export default {
    template: `
        <div class="reaction-container">
            <button 
                class="reaction-btn"
                :class="{ 'reacted': reacted }"
                @click="toggleReaction"
            >
                <span class="emoji">{{ emoji }}</span>
                <span v-if="count > 0" class="count">{{ count }}</span>
            </button>
        </div>
    `,
    props: {
        emoji: { type: String, default: '👍' },
        count: { type: Number, default: 0 },
        reacted: { type: Boolean, default: false }
    },
    emits: ['react'],
    methods: {
        toggleReaction() {
            this.$emit('react', this.emoji);
        }
    }
};
