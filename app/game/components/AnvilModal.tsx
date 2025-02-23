import { useConversation } from '@11labs/react';
import { useCallback, useState } from 'react';

interface AnvilModalProps {
  onClose: () => void;
}

interface AIMessage {
  source: 'ai' | 'user';
  message: string;
}

export function AnvilModal({ onClose }: AnvilModalProps) {
  const [forgedItemImage, setForgedItemImage] = useState<string | null>(null);
  const [isForging, setIsForging] = useState(false);
  const [itemDescription, setItemDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [testPrompt, setTestPrompt] = useState('');

  const conversation = useConversation({
    onConnect: () => console.log('Connected'),
    onDisconnect: () => console.log('Disconnected'),
    onMessage: async (message: AIMessage) => {
      console.log('Message:', message);
      // When we receive a message, treat it as an item description and start forging
      if (message.source === 'ai' && message.message && !isForging) {
        setItemDescription(message.message);
        await forgeItem(message.message);
      }
    },
    onError: (error: string | Error) => console.error('Error:', error),
  });

  const getSignedUrl = async (): Promise<string> => {
    const response = await fetch("/api/get-signed-url");
    if (!response.ok) {
      throw new Error(`Failed to get signed url: ${response.statusText}`);
    }
    const { signedUrl } = await response.json();
    return signedUrl;
  };

  const forgeItem = async (description: string) => {
    try {
      setIsForging(true);
      setError(null);

      const response = await fetch('/api/forge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ description }),
      });

      if (!response.ok) {
        throw new Error('Failed to forge item');
      }

      const data = await response.json();
      setForgedItemImage(data.imageUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to forge item');
    } finally {
      setIsForging(false);
    }
  };

  const startConversation = useCallback(async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const signedUrl = await getSignedUrl();
      await conversation.startSession({
        agentId: process.env.NEXT_PUBLIC_AGENT_ID!,
        signedUrl: signedUrl,
      });
    } catch (error) {
      console.error('Failed to start conversation:', error);
    }
  }, [conversation]);

  const stopConversation = useCallback(async () => {
    await conversation.endSession();
  }, [conversation]);

  const handleTestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (testPrompt.trim()) {
      setItemDescription(testPrompt);
      await forgeItem(testPrompt);
      setTestPrompt(''); // Clear input after submission
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50">
      <div className="relative w-[1000px] h-[600px] bg-[#2c1810] rounded-lg shadow-2xl border-2 border-[#8B4513] overflow-hidden">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#D2691E] hover:text-[#8B4513] transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Book content */}
        <div className="p-8 h-full flex">
          {/* Left side - Grimoire text */}
          <div className="flex-1 flex flex-col pr-6 border-r-2 border-[#8B4513]">
            {/* Title */}
            <h2 className="text-3xl font-medieval text-[#D2691E] text-center mb-6 font-bold">
              Blacksmith's Grimoire
            </h2>

            {/* Main content area */}
            <div className="flex-1 bg-[#1a0f0a] rounded-lg p-6 mb-6 overflow-y-auto">
              <div className="space-y-4 text-[#D2691E]">
                <p className="font-medieval text-lg">
                  Welcome to the ancient forge. Here lies the knowledge of countless generations of master smiths.
                  Through the mystical bond between smith and anvil, we shall craft items of legend.
                </p>

                <div className="border-t border-[#8B4513] my-6"></div>

                <div className="text-center">
                  <p className="font-medieval text-lg mb-4">
                    Status: {conversation.status === 'connected' ?
                      'Connected to the anvil\'s spirit' :
                      'Awaiting mystical connection'}
                  </p>

                  {conversation.status === 'connected' && (
                    <p className="font-medieval text-lg italic">
                      The anvil is {conversation.isSpeaking ? 'speaking' : 'listening'}...
                    </p>
                  )}

                  {itemDescription && (
                    <div className="mt-6 p-4 bg-[#2c1810] rounded-lg border border-[#8B4513]">
                      <h3 className="font-medieval text-lg mb-2">Current Commission:</h3>
                      <p className="text-[#D2691E]/80 italic">{itemDescription}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Control buttons */}
            <div className="flex justify-center gap-4">
              <button
                onClick={startConversation}
                disabled={conversation.status === 'connected'}
                className={`px-6 py-3 rounded-lg font-medieval text-lg transition-colors ${conversation.status === 'connected'
                  ? 'bg-[#3d2317] text-[#8B4513] cursor-not-allowed'
                  : 'bg-[#8B4513] text-[#D2691E] hover:bg-[#6b3410]'
                  }`}
              >
                Begin Communion
              </button>
              <button
                onClick={stopConversation}
                disabled={conversation.status !== 'connected'}
                className={`px-6 py-3 rounded-lg font-medieval text-lg transition-colors ${conversation.status !== 'connected'
                  ? 'bg-[#3d2317] text-[#8B4513] cursor-not-allowed'
                  : 'bg-[#8B4513] text-[#D2691E] hover:bg-[#6b3410]'
                  }`}
              >
                End Communion
              </button>
            </div>
          </div>

          {/* Right side - Forged Item Display */}
          <div className="w-[300px] pl-6 flex flex-col">
            <h3 className="text-2xl font-medieval text-[#D2691E] text-center mb-6 font-bold">
              Forged Creation
            </h3>
            <div className="flex-1 bg-[#1a0f0a] rounded-lg p-4 flex flex-col items-center justify-center border-2 border-[#8B4513]/50">
              {/* Image display area */}
              <div className="w-48 h-48 bg-[#2c1810] rounded-lg border-2 border-[#8B4513]/30 flex items-center justify-center overflow-hidden">
                {isForging ? (
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#D2691E] border-t-transparent mb-2"></div>
                    <p className="text-[#8B4513] font-medieval text-sm">Forging in progress...</p>
                  </div>
                ) : forgedItemImage ? (
                  <img
                    src={forgedItemImage}
                    alt="Forged item"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <p className="text-[#8B4513] font-medieval text-center px-4">
                    Your masterwork will appear here
                  </p>
                )}
              </div>

              {/* Error display */}
              {error && (
                <div className="mt-4 text-red-500 text-sm text-center">
                  {error}
                </div>
              )}

              {/* Item status */}
              <div className="mt-4 w-full">
                <div className="text-[#D2691E] font-medieval text-center">
                  {isForging ? '🔨 Forging in Progress 🔨' :
                    forgedItemImage ? '✨ Creation Complete ✨' :
                      '⚔️ Awaiting Creation ⚔️'}
                </div>
              </div>

              {/* Test Prompt Input */}
              <form onSubmit={handleTestSubmit} className="mt-6 w-full">
                <div className="border-t border-[#8B4513] pt-4">
                  <input
                    type="text"
                    value={testPrompt}
                    onChange={(e) => setTestPrompt(e.target.value)}
                    placeholder="Enter test prompt..."
                    className="w-full px-3 py-2 bg-[#2c1810] border border-[#8B4513] rounded-lg text-[#D2691E] placeholder-[#8B4513] font-medieval text-sm mb-2"
                    disabled={isForging}
                  />
                  <button
                    type="submit"
                    disabled={isForging || !testPrompt.trim()}
                    className={`w-full px-4 py-2 rounded-lg font-medieval text-sm transition-colors
                      ${isForging || !testPrompt.trim()
                        ? 'bg-[#3d2317] text-[#8B4513] cursor-not-allowed'
                        : 'bg-[#8B4513] text-[#D2691E] hover:bg-[#6b3410]'
                      }`}
                  >
                    Test Forge
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 