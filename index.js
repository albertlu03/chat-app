import { createApp } from "vue";
import { GraffitiLocal } from "@graffiti-garden/implementation-local";
import { GraffitiRemote } from "@graffiti-garden/implementation-remote";
import { GraffitiPlugin } from "@graffiti-garden/wrapper-vue";

createApp({
    data() {
        return {
            myMessage: "",
            sending: false,
            newChatName: "",
            selectedChannel: null,
            currentGroupName: "",
            groupNameEdit: "",
            scheduleEnabled: false,
            scheduledTime: "",
            groupSchema: {
                properties: {
                    value: {
                        required: ['activity', 'object'],
                        properties: {
                            activity: { const: 'Create' },
                            object: {
                                required: ['type', 'name', 'channel'],
                                properties: {
                                    type: { const: 'Group Chat' },
                                    name: { type: 'string' },
                                    channel: { type: 'string' }
                                }
                            }
                        }
                    }
                }
            },
            messageSchema: {
                properties: {
                    value: {
                        required: ['content', 'published'],
                        properties: {
                            content: { type: 'string' },
                            published: { type: 'number' }
                        }
                    }
                }
            },
            nameUpdateSchema: {
                properties: {
                    value: {
                        required: ['name', 'describes'],
                        properties: {
                            name: { type: 'string' },
                            describes: { type: 'string' }
                        }
                    }
                }
            },
            memberSchema: {
                properties: {
                    value: {
                        required: ['activity', 'target'],
                        properties: {
                            activity: { const: 'Join' },
                            target: { type: 'string' }
                        }
                    }
                }
            },
            inviteSchema: {
                properties: {
                    value: {
                        required: ['activity', 'object', 'target'],
                        properties: {
                            activity: { const: 'Invite' },
                            object: { type: 'string' },
                            target: { type: 'string' }
                        }
                    }
                }
            },
            removeSchema: {
                properties: {
                    value: {
                        required: ['activity', 'object', 'target'],
                        properties: {
                            activity: { const: 'Remove' },
                            object: { type: 'string' },
                            target: { type: 'string' }
                        }
                    }
                }
            },
            leaveSchema: {
                properties: {
                    value: {
                        required: ['activity', 'target'],
                        properties: {
                            activity: { const: 'Leave' },
                            target: { type: 'string' }
                        }
                    }
                }
            }
        };
    },

    computed: {
        minScheduleTime() {
            const now = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now
            const tzOffset = now.getTimezoneOffset() * 60000; // offset in ms
            const localTime = new Date(now.getTime() - tzOffset);
            return localTime.toISOString().slice(0, 16);
        }
    },

    methods: {
        async sendMessage(session) {
            if (!this.myMessage) return;

            if (this.scheduleEnabled) {
                const publishTime = new Date(this.scheduledTime).getTime();
                const now = Date.now();
                const minDelayMs = 5 * 60 * 1000;

                if (publishTime - now < minDelayMs) {
                    alert('Scheduled time must be at least 5 minutes from now');
                    return;
                }

                this.sending = true;

                try {
                    const messageObj = {
                        value: {
                            content: this.myMessage,
                            published: publishTime,
                            scheduled: true,
                        },
                        channels: [this.selectedChannel],
                    };

                    await this.$graffiti.put(messageObj, session);

                    this.myMessage = '';
                    this.scheduleEnabled = false;
                    this.scheduledTime = '';
                } finally {
                    this.sending = false;
                    this.$nextTick(() => this.$refs.messageInput?.focus());
                }
            } else {
                // Immediate send
                this.sending = true;

                try {
                    const messageObj = {
                        value: {
                            content: this.myMessage,
                            published: Date.now(),
                            scheduled: false,
                        },
                        channels: [this.selectedChannel],
                    };

                    await this.$graffiti.put(messageObj, session);

                    this.myMessage = '';
                } finally {
                    this.sending = false;
                    this.$nextTick(() => this.$refs.messageInput?.focus());
                }
            }
        },

        async createGroupChat() {
            if (!this.newChatName) return;
            
            await this.$graffiti.put({
                value: {
                    activity: 'Create',
                    object: {
                        type: 'Group Chat',
                        name: this.newChatName,
                        channel: crypto.randomUUID()
                    }
                },
                channels: ['designftw']
            }, this.$graffitiSession.value);
            
            this.newChatName = '';
        },

        selectGroup(group) {
            this.selectedChannel = group.channel;
            this.currentGroupName = group.name;
            this.groupNameEdit = group.name;
        },

        async updateGroupName() {
            await this.$graffiti.put({
                value: {
                    name: this.groupNameEdit,
                    describes: this.selectedChannel
                },
                channels: [this.selectedChannel]
            }, this.$graffitiSession.value);
        },

        async editMessage(message) {
            const newContent = prompt("Edit message:", message.value.content);
            if (newContent && newContent !== message.value.content) {
                await this.$graffiti.patch({
                    value: [{
                        op: 'replace',
                        path: '/value/content',
                        value: newContent
                    }]
                }, message, this.$graffitiSession.value);
            }
        },

        async deleteMessage(message) {
            if (confirm("Delete this message?")) {
                await this.$graffiti.delete(message, this.$graffitiSession.value);
            }
        },

        formatFutureTime(timestamp) {
            const now = Date.now();
            if (timestamp <= now) return 'Now';
            
            const diffSeconds = Math.floor((timestamp - now) / 1000);
            const hours = Math.floor(diffSeconds / 3600);
            const minutes = Math.floor((diffSeconds % 3600) / 60);
            
            return `in ${hours}h ${minutes}m`;
        }
    }
})
.use(GraffitiPlugin, {
    graffiti: new GraffitiLocal(),
    // graffiti: new GraffitiRemote(),
})
.mount("#app");
