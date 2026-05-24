import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { toast } from '@/components/ui/toast';

const forgotSchema = z.object({
  email: z.string().min(1, 'error.required').email('error.email'),
});

type ForgotData = z.infer<typeof forgotSchema>;

export function ForgotPasswordPage() {
  const { t } = useTranslation(['auth', 'common']);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotData>({ resolver: zodResolver(forgotSchema) });

  const onSubmit = (_data: ForgotData): void => {
    // Placeholder — implémentation API en P-10b
    toast.success(t('forgot.success', { ns: 'auth' }));
  };

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">{t('forgot.title', { ns: 'auth' })}</CardTitle>
        <CardDescription>{t('forgot.subtitle', { ns: 'auth' })}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => { void handleSubmit(onSubmit)(e); }} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="email">{t('forgot.email', { ns: 'auth' })}</Label>
            <Input
              id="email"
              type="email"
              placeholder={t('forgot.email.placeholder', { ns: 'auth' })}
              autoComplete="email"
              {...register('email')}
            />
            {errors.email && <p className="text-xs text-red-500">{t(errors.email.message ?? 'error.required', { ns: 'common' })}</p>}
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? t('btn.loading', { ns: 'common' }) : t('forgot.submit', { ns: 'auth' })}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center text-sm text-[--text-muted]">
        <Link to="/auth/login" className="text-[--accent] hover:underline font-medium">{t('forgot.back', { ns: 'auth' })}</Link>
      </CardFooter>
    </Card>
  );
}
