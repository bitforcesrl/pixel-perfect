import PasswordGate from './components/PasswordGate';
import PixelPerfectApp from './components/PixelPerfectApp';

export default function Home() {
  return (
    <PasswordGate>
      <PixelPerfectApp />
    </PasswordGate>
  );
}
