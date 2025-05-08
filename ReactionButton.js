export default {
    template: `
        <div class="reaction-container">
            <button 
                class="reaction-btn"
                :class="{ 'reacted': reacted, 'bounce': isBouncing }"
                @click="handleClick"
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
    data() {
        return {
            isBouncing: false
        };
    },
    methods: {
        handleClick() {
            this.isBouncing = false;
            this.$nextTick(() => {
                this.isBouncing = true;
                setTimeout(() => (this.isBouncing = false), 300);
            });
            this.$emit('react', this.emoji);
        }
    }
};
